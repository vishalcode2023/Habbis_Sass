const jwt = require("jsonwebtoken");

const createToken = (data) => {
  try {
    const token = jwt.sign(data, process.env.JWT_SECRET, { expiresIn: "1h" });
    return token;
  } catch (error) {
    console.error("Error creating JWT:", error);
    throw new Error("Failed to create token");
  }
};

module.exports = { createToken };