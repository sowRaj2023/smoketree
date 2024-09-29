const express = require("express");
const path = require("path");
const sqlite3 = require("sqlite3").verbose();
const { open } = require("sqlite");

const app = express();
app.use(express.json());

const dbPath = path.join(__dirname, "database", "database.db");
let db = null;

const initializeDBAndServer = async () => {
    try {
        db = await open({
            filename: dbPath,
            driver: sqlite3.Database,
        });

        // Create User and Address Tables
        await db.exec(`
      CREATE TABLE IF NOT EXISTS User (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL
      );
      
      CREATE TABLE IF NOT EXISTS Address (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        address TEXT NOT NULL,
        FOREIGN KEY (user_id) REFERENCES User(id) ON DELETE CASCADE
      );
    `);

        app.listen(3004, () => {
            console.log("Server is running on http://localhost:3004");
        });
    } catch (e) {
        console.error(`DB Error: ${e.message}`);
        process.exit(1);
    }
};

initializeDBAndServer();

app.post("/users", async (req, res) => {
    const { name, addresses } = req.body;

    // Check if the name is valid (not empty and is a string)
    if (typeof name !== 'string' || name.trim() === "") {
        return res.status(400).send("Invalid name input");
    }

    // Check if addresses is an array and contains at least one address
    if (!Array.isArray(addresses) || addresses.length === 0 || !addresses.every(addr => typeof addr === 'string' && addr.trim() !== "")) {
        return res.status(400).send("Invalid address input");
    }

    try {
        // Insert User into User table
        const addUserQuery = `INSERT INTO User (name) VALUES ('${name}');`;
        const result = await db.run(addUserQuery);
        const userId = result.lastID;

        // Insert each address into Address table
        const addressPromises = addresses.map((address) => {
            const addAddressQuery = `
          INSERT INTO Address (user_id, address) 
          VALUES (${userId}, '${address.trim()}');
        `;
            return db.run(addAddressQuery);
        });

        await Promise.all(addressPromises);

        res.status(200).send("User and addresses added successfully!");
    } catch (e) {
        res.status(500).send("Error adding user and address");
    }
});


// Endpoint to get all users with their addresses
app.get("/users", async (req, res) => {
    try {
        const getUsersQuery = `
      SELECT 
        User.id, 
        User.name, 
        GROUP_CONCAT(Address.address, ', ') AS addresses
      FROM User
      LEFT JOIN Address ON User.id = Address.user_id
      GROUP BY User.id;
    `;
        const users = await db.all(getUsersQuery);
        res.send(users);
    } catch (e) {
        res.status(500).send("Error retrieving users");
    }
});