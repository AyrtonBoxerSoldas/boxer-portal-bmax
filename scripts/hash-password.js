const bcrypt = require("bcryptjs");

const password = "Danilo";

const hash = await bcrypt.hash(password, 10);
console.log("Hash:", hash);