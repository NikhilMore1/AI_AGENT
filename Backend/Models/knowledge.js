// models/Knowledge.js
import mongoose from "mongoose";

const knowledgeSchema = new mongoose.Schema({
  question: { type: String, unique: true },
  answer: String,
  createdAt: { type: Date, default: Date.now },
});

export default mongoose.models.Knowledge || mongoose.model("Knowledge", knowledgeSchema);
