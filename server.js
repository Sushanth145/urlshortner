require("dotenv").config();
const express = require("express");
const { Pool } = require("pg");
const shortid = require("shortid");
const Redis = require("ioredis");

const app = express();
app.use(express.json());

const cors = require("cors");
app.use(cors({
    origin: "http://localhost:3001",
    methods: "GET,POST",
    allowedHeaders: "Content-Type"
}));


const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
});

const redis = new Redis(process.env.REDIS_URL);

app.post("/shorten", async (req, res) => {
    const { originalUrl } = req.body;
    const shortCode = shortid.generate();

    try {
        await pool.query("INSERT INTO urls (short_code, original_url) VALUES ($1, $2)", [shortCode, originalUrl]);
        await redis.set(shortCode, originalUrl);
        res.json({ shortUrl: `${process.env.BASE_URL}/${shortCode}` });
    } catch (error) {
        res.status(500).json({ error: "Database error" });
    }
});

app.get("/:shortCode", async (req, res) => {
    const { shortCode } = req.params;

    const cachedUrl = await redis.get(shortCode);
    if (cachedUrl) return res.redirect(cachedUrl);

    const result = await pool.query("SELECT original_url FROM urls WHERE short_code = $1", [shortCode]);
    if (result.rows.length) {
        await redis.set(shortCode, result.rows[0].original_url);
        return res.redirect(result.rows[0].original_url);
    }

    res.status(404).json({ error: "URL not found" });
});

app.listen(3000, () => console.log("Server running on port 3000"));