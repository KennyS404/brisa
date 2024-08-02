import express, { Request, Response } from "express";
import axios from "axios";
import bodyParser from "body-parser";
import mongoose from "mongoose";
import Question from "./models/question";
import { contextText } from "./context";

// Inicializando o aplicativo Express
const app = express();
const port = 5000;

// Configurando o middleware para analisar o corpo das requisições JSON
app.use(bodyParser.json());

// Conectando ao MongoDB
mongoose.connect("mongodb://localhost:27017/questions")
  .then(() => {
    console.log("Conectado ao MongoDB");
  })
  .catch(err => {
    console.error("Erro ao conectar ao MongoDB", err);
  });

// Função para obter o contexto das perguntas anteriores para um ID específico
const getContext = async (senderId: string): Promise<string> => {
  const questions = await Question.find({ senderId }).sort({ messageTimestamp: 1 }).exec();
  return questions.map(q => `${q.pushName}: ${q.prompt}\nResposta: ${q.response || ''}`).join("\n");
};

// Definindo a rota POST /generate
app.post("/generate", async (req: Request, res: Response) => {
  const { prompt, senderId, pushName, messageTimestamp } = req.body;

  // Verificando se o prompt, senderId, pushName e messageTimestamp foram fornecidos
  if (!prompt || !senderId || !pushName || !messageTimestamp) {
    return res.status(400).json({ error: "Prompt, senderId, pushName e messageTimestamp são obrigatórios" });
  }

  // Salvando a pergunta no MongoDB
  const newQuestion = new Question({ prompt, senderId, pushName, messageTimestamp });
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
    // Fazendo a requisição POST para a API externa
    const apiResponse = await axios.post(url, apiData);

    // Extraindo a mensagem de resposta
    const message = apiResponse.data.response || "Nenhuma resposta encontrada";

    // Atualizando a pergunta no MongoDB com a resposta
    newQuestion.response = message;
    await newQuestion.save();

    // Retornando a mensagem como resposta da API Express
    res.status(200).json({ message });
  } catch (error) {
    console.error("Erro:", error);

    // Usando um type guard para verificar se o erro é um objeto do axios
    if (axios.isAxiosError(error)) {
      res.status(error.response?.status || 500).json({
        error: `Falha ao obter resposta. Código de status: ${error.response?.status || "desconhecido"}`,
      });
    } else {
      res.status(500).json({ error: "Ocorreu um erro inesperado" });
    }
  }
});

// Iniciando o servidor
app.listen(port, "0.0.0.0", () => {
  console.log(`Servidor está rodando em http://0.0.0.0:${port}`);
});
