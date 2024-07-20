import mongoose, { Schema, Document } from "mongoose";

export interface IQuestion extends Document {
  prompt: string;
  senderId: string;
  pushName: string;
  messageTimestamp: Date;
  response?: string; // Adicionando o campo response
}

const QuestionSchema: Schema = new Schema({
  prompt: { type: String, required: true },
  senderId: { type: String, required: true },
  pushName: { type: String, required: true },
  messageTimestamp: { type: Date, required: true },
  response: { type: String } // Definindo o campo response no schema
});

export default mongoose.model<IQuestion>("Question", QuestionSchema);
