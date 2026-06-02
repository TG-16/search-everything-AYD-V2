const db = require("../config/db");

const getUser = async (email) => {
  const query = `
    SELECT id, name, password
    FROM users
    WHERE email = $1
    LIMIT 1;
  `;
  const values = [email];
  const { rows } = await pool.query(query, values);
  return rows[0] || null;
};

const registerUser = async ({ userName, email, password }) => {
  const query = `
    INSERT INTO users (
      name,
      email,
      password
    )
    VALUES ($1, $2, $3)
    RETURNING id, name, email;
  `;

  const values = [userName, email, password];

  const { rows } = await pool.query(query, values);

  return rows[0];
};

module.exports = {
  getUser,
  registerUser,
};
