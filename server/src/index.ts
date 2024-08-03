import express, { Request, Response } from "express";
import axios from "axios";
import bodyParser from "body-parser";
import mongoose from "mongoose";
import Question from "./models/question";
import { contextText } from "./context";

const app = express();
const port = 5000;

app.use(bodyParser.json());

mongoose
  .connect("mongodb://admin:secret@localhost:27017/questions")
  .then(() => {
    console.log("Connected to MongoDB");
  })
  .catch((err) => {
    console.error("Error connecting to MongoDB", err);
  });

const getContext = async (senderId: string): Promise<string> => {
  const questions = await Question.find({ senderId })
    .sort({ messageTimestamp: 1 })
    .exec();
  return questions
    .map((q) => `${q.pushName}: ${q.prompt}\nResposta: ${q.response || ""}`)
    .join("\n");
};

app.post("/generate", async (req: Request, res: Response) => {
  const { prompt, senderId, pushName, messageTimestamp } = req.body;

  if (!prompt || !senderId || !pushName || !messageTimestamp) {
    return res.status(400).json({
      error: "Prompt, senderId, pushName e messageTimestamp são obrigatórios",
    });
  }

  const newQuestion = new Question({
    prompt,
    senderId,
    pushName,
    messageTimestamp,
  });
  await newQuestion.save();

  const context = await getContext(senderId);
  const url = "http://localhost:11434/api/generate";
  const apiData = {
    model: "llama3",
    prompt: `Você é um assistente virtual da TechNova Solutions e sempre 
    responde de forma educada e profissional e resumida. Sempre * CITE 
    O NOME DO USUÁRIO NA MENSAGEM O NOME DO USUÁRIO É ${pushName}* #IMPORTANTE *Se a 
    pergunta não estiver relacionada ao CONTEXTO DA EMPRESA, diga que só pode responder a 
    perguntas relacionadas ao suporte técnico da TechNova Solutions de forma educada, resumida
     e profissional*.\nESSE É O CONTEXTO DA EMPRESA: ${contextText}\nMensagens anteriores:\n${context}\n\nUsuário:
      ${pushName}: ${prompt} #Não esqueça de citar o nome do usuário na sua resposta, pois você é um
       assistente virtual e responde de forma humanizada`,
    stream: false,
  };

  try {
    const apiResponse = await axios.post(url, apiData);

    const message = apiResponse.data.response || "Nenhuma resposta encontrada";

    newQuestion.response = message;
    await newQuestion.save();

    res.status(200).json({ message });
  } catch (error) {
    console.error("Erro:", error);

    if (axios.isAxiosError(error)) {
      res.status(error.response?.status || 500).json({
        error: `Falha ao obter resposta. Código de status: ${
          error.response?.status || "desconhecido"
        }`,
      });
    } else {
      res.status(500).json({ error: "Ocorreu um erro inesperado" });
    }
  }
});

app.listen(port, "0.0.0.0", () => {
  console.log(`Servidor está rodando em http://0.0.0.0:${port}`);
});
