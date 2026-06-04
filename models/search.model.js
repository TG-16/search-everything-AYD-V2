// File: services/SearchService.js

const db = require('../config/db');
const FilterBuilder = require('../utils/FilterBuilder');
const { pipeline } = require('@huggingface/transformers');

let embeddingPipelineInstance = null;
let rerankerPipelineInstance = null;

class SearchService {
  /**
   * Initializes ML models sequentially.
   * Leverages caching to guarantee assets load into RAM exactly once.
   */
  static async initPipelines() {
    if (!embeddingPipelineInstance) {
      console.log('[Search Engine] Instantiating Vector Embedding Pipeline...');
      embeddingPipelineInstance = await pipeline('feature-extraction', 'Xenova/bge-small-en-v1.5');
    }
    if (!rerankerPipelineInstance) {
      console.log('[Search Engine] Instantiating Cross-Encoder Reranker...');
      rerankerPipelineInstance = await pipeline('text-classification', 'Xenova/ms-marco-MiniLM-L-6-v2');
    }
    return { encoder: embeddingPipelineInstance, reranker: rerankerPipelineInstance };
  }

  /**
   * Core Search Workflow Execution Method
   */
  static async executeHybridSearch({ workspaceId, rawQuery, filters = {}, limit = 10 }) {
    const startTimestamp = Date.now();
    const candidateLimit = 50; // Fetch an expanded pool for reranking

    // 1. Fail-Safe Timeout Protection Wrapper (3500ms limit)
    return Promise.race([
      this._processSearch(workspaceId, rawQuery, filters, candidateLimit, limit),
      new Promise((_, reject) => setTimeout(() => reject(new Error('SEARCH_TIMEOUT')), 3500))
    ]).catch(async (error) => {
      console.error(`[Search Service Alert] Execution degraded: ${error.message}`);
      // Graceful fallback logic if downstream ML models crash or lag
      return await this._fallbackDatabaseOnlySearch(workspaceId, rawQuery, filters, limit);
    });
  }

  /**
   * Full Search Pipeline Implementation
   */
  static async _processSearch(workspaceId, rawQuery, filters, candidateLimit, clientFinalLimit) {
    const { encoder, reranker } = await this.initPipelines();

    // Step A: Generate the embedding vector
    const cleanQuery = rawQuery.trim() || ' ';
    const embeddingOutput = await encoder(cleanQuery, { pooling: 'mean', normalize: true });
    const queryVector = Array.from(embeddingOutput.data);

    // Step B: Build dynamic metadata filtering statement structures
    const filterData = FilterBuilder.build(filters, 4); // Filter parameters start at position $4

    // Inject filter clauses into the SQL query layout
    const hybridSqlQuery = `
      WITH fts_search AS (
          SELECT registry_id, ROW_NUMBER() OVER (ORDER BY ts_rank(searchable_tsv, websearch_to_tsquery('english', $1)) DESC) as rank_position
          FROM "global_registry_${workspaceId}"
          WHERE searchable_tsv @@ websearch_to_tsquery('english', $1) ${filterData.sql}
          LIMIT ${candidateLimit}
      ),
      vector_search AS (
          SELECT registry_id, ROW_NUMBER() OVER (ORDER BY embedding <=> $2 ASC) as rank_position
          FROM "global_registry_${workspaceId}"
          WHERE embedding_status = 'completed' ${filterData.sql}
          LIMIT ${candidateLimit}
      ),
      fuzzy_search AS (
          SELECT registry_id, ROW_NUMBER() OVER (ORDER BY similarity(searchable_text, $1) DESC) as rank_position
          FROM "global_registry_${workspaceId}"
          WHERE searchable_text % $1 ${filterData.sql}
          LIMIT ${candidateLimit}
      ),
      unified_universe AS (
          SELECT registry_id FROM fts_search
          UNION
          SELECT registry_id FROM vector_search
          UNION
          SELECT registry_id FROM fuzzy_search
      )
      SELECT 
          u.registry_id, r.source_table, r.source_row_id, r.metadata, r.searchable_text,
          (
              COALESCE((SELECT 1.0 / (60.0 + rank_position) FROM fts_search WHERE registry_id = u.registry_id), 0.0) +
              COALESCE((SELECT 1.0 / (60.0 + rank_position) FROM vector_search WHERE registry_id = u.registry_id), 0.0) +
              COALESCE((SELECT 1.0 / (60.0 + rank_position) FROM fuzzy_search WHERE registry_id = u.registry_id), 0.0)
          ) AS rrf_score
      FROM unified_universe u
      JOIN "global_registry_${workspaceId}" r ON u.registry_id = r.registry_id
      ORDER BY rrf_score DESC
      LIMIT $3;
    `;

    const queryParameters = [rawQuery, JSON.stringify(queryVector), candidateLimit, ...filterData.values];
    const { rows: databaseCandidates } = await db.query(hybridSqlQuery, queryParameters);

    if (databaseCandidates.length === 0) {
      return [];
    }

    // Step C: Execute Cross-Encoder Reranking
    // Prepare the candidate context inputs
    const rerankerInputs = databaseCandidates.map(row => {
      const meta = row.metadata || {};
      const contextString = `Name: ${meta.name || ''} | Category: ${meta.category || ''} | Context: ${row.searchable_text || ''}`;
      return { text: rawQuery, text_pair: contextString };
    });

    // Execute batch evaluation via Transformers pipeline
    const rerankOutputs = await reranker(rerankerInputs);

    // Step D: Calculate final blended scores
    const rerankedCollection = databaseCandidates.map((row, idx) => {
      // The Cross-Encoder outputs raw logit weights; apply sigmoid or mapping if needed
      // Extract the output score from the model prediction object
      const crossEncoderScore = rerankOutputs[idx].score; 
      const normalizedRrf = row.rrf_score / 0.05; // Quick feature scaling normalization scaling factor

      /**
       * Blending Formula: 30% Base RRF position relevance + 70% Deep Cross-Encoder validation
       * This gives the Cross-Encoder primary influence over the final order,
       * while using RRF as a tie-breaker for structural relevance.
       */
      const finalBlendedScore = (0.3 * normalizedRrf) + (0.7 * crossEncoderScore);

      return {
        source_table: row.source_table,
        source_row_id: row.source_row_id,
        metadata: row.metadata,
        search_metrics: {
          rrf_raw: row.rrf_score,
          cross_encoder_validation: crossEncoderScore,
          final_score: finalBlendedScore
        }
      };
    });

    // Sort by the final blended score and apply the client's limit constraint
    return rerankedCollection
      .sort((a, b) => b.search_metrics.final_score - a.search_metrics.final_score)
      .slice(0, clientFinalLimit);
  }

  /**
   * Database-Only Fallback Routine
   * Executed if ML pipeline operations time out or error out.
   */
  static async _fallbackDatabaseOnlySearch(workspaceId, rawQuery, filters, clientFinalLimit) {
    console.warn(`[Search Service Executing Fallback] Database-only mode active for workspace: ${workspaceId}`);
    const filterData = FilterBuilder.build(filters, 3);
    
    const fallbackSql = `
      WITH fts_search AS (
          SELECT registry_id, ROW_NUMBER() OVER (ORDER BY ts_rank(searchable_tsv, websearch_to_tsquery('english', $1)) DESC) as rank_position
          FROM "global_registry_${workspaceId}"
          WHERE searchable_tsv @@ websearch_to_tsquery('english', $1) ${filterData.sql}
          LIMIT $2
      )
      SELECT r.source_table, r.source_row_id, r.metadata, 1.0 as fallback_active
      FROM fts_search f
      JOIN "global_registry_${workspaceId}" r ON f.registry_id = r.registry_id
      LIMIT $2;
    `;

    const { rows } = await db.query(fallbackSql, [rawQuery, clientFinalLimit, ...filterData.values]);
    return rows.map(row => ({
      source_table: row.source_table,
      source_row_id: row.source_row_id,
      metadata: row.metadata,
      search_metrics: { rrf_raw: null, cross_encoder_validation: null, final_score: 1.0 }
    }));
  }
}

module.exports = SearchService;