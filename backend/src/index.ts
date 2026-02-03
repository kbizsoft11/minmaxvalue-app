import dotenv from "dotenv";
dotenv.config();

import express from "express";
import cors from "cors";
import stripeRoutes from "./routes/stripe";

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json());

app.use("/stripe", stripeRoutes);

app.get("/health", (_req, res) => {
    res.json({ status: true });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`Backend running on http://localhost:${PORT}`);
});
