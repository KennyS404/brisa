import express, { raw, Request, Response } from "express";
import axios from "axios";
import bodyParser from "body-parser";
import mongoose from "mongoose";
import Question from "./models/question";
import { contextText } from "./context";
import cluster from "cluster";
import os from "os";

const port = 5000;
const mongoPassword = "ytRdoukyZBXsYHv1";

// Função para iniciar o servidor Express
const startServer = async () => {
  try {
    await mongoose.connect(
      `mongodb://admin:${mongoPassword}@localhost:27017/questions`,
      {
        authSource: "admin",
      }
    );
    console.log("Connected to MongoDB");

    const app = express();
    app.use(bodyParser.json());

    app.post("/generate", async (req: Request, res: Response) => {
      const { prompt, senderId, pushName, messageTimestamp } = req.body;

      if (!prompt || !senderId || !pushName || !messageTimestamp) {
        return res.status(400).json({
          error:
            "Prompt, senderId, pushName e messageTimestamp são obrigatórios",
        });
      }

      try {
        const newQuestion = new Question({
          prompt,
          senderId,
          pushName,
          messageTimestamp,
        });
        await newQuestion.save();

        const context = await getContext(senderId);
        // console.log(prompt, context);
        const url = "http://localhost:11434/api/generate";
        const apiData = {
          model: "llama3.1",
          prompt: `Você é um assistente virtual da Fflip e sempre 
          responde de forma educada e profissional e extremamente resumida. 
          Sempre responda exatamente o que está no CONTEXTO DA EMPRESA, sem inventar ou criar coisas fora do CONTEXTO DA EMPRESA Fflip. 
          Sempre * CITE 
          O NOME DO USUÁRIO NA MENSAGEM O NOME DO USUÁRIO É ${pushName}* #IMPORTANTE *Se a 
          pergunta não estiver relacionada ao CONTEXTO DA EMPRESA, diga que só pode responder a 
          perguntas relacionadas ao suporte técnico da Fflip Solutions de forma educada, extremamente resumida
           e profissional*.\nESSE É O CONTEXTO DA EMPRESA: ${contextText}\nMensagens anteriores:\n${context}\n\nUsuário:
            ${pushName}: ${prompt} #Não esqueça de citar o nome do usuário na sua resposta, pois você é um
             assistente virtual e responde de forma humanizada.
             `,
          stream: false,
        };
        console.log(url);

        const apiResponse = await axios.post(url, apiData);
        console.log(apiResponse.data);
        const message =
          apiResponse.data.response || "Nenhuma resposta encontrada";

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
  } catch (err) {
    console.error("Error connecting to MongoDB", err);
  }
};

const getContext = async (senderId: string): Promise<string> => {
  const questions = await Question.find({ senderId })
    .sort({ messageTimestamp: 1 })
    .exec();
  return questions
    .map((q) => `${q.pushName}: ${q.prompt}\nResposta: ${q.response || ""}`)
    .join("\n");
};

if (cluster.isMaster) {
  const numCPUs = os.cpus().length;
  for (let i = 0; i < numCPUs; i++) {
    cluster.fork();
  }

  cluster.on("exit", (worker, code, signal) => {
    console.log(`Worker ${worker.process.pid} died`);
  });
} else {
  // Apenas um worker deve iniciar o servidor e conectar ao MongoDB
  if (cluster.worker?.id === 1) {
    startServer();
  }
}
