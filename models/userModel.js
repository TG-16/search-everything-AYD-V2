const db = require("../config/db");

const getUser = async (email) => {
  const query = `
    SELECT id, name, password
    FROM users
    WHERE email = $1
    LIMIT 1;
  `;
  const values = [email];
  const { rows } = await db.query(query, values);
  return rows[0] || null;
};

const registerUser = async ({ userName, email, password, auth_provider }) => {
  const query = `
    INSERT INTO users (
      name,
      email,
      password,
      auth_provider
    )
    VALUES ($1, $2, $3, $4)
    RETURNING id, name, email;
  `;

  const values = [userName, email, password, auth_provider];

  const { rows } = await db.query(query, values);

  return rows[0];
};

const updateUserPassword = async (id, hashedPassword) => {
  const query = `
    UPDATE users
    SET password = $1
    WHERE id = $2
    RETURNING id;
  `;
  const values = [hashedPassword, id];

  const { rows } = await db.query(query, values);

  // Returns true if a row was updated, false if the user ID wasn't found
  return rows.length > 0;
};

module.exports = {
  getUser,
  registerUser,
  updateUserPassword,
};
