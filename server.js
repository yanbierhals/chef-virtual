require('dotenv').config();
const express = require('express');
const axios = require('axios');
const cors = require('cors');
const path = require('path');
const { marked } = require('marked');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Configuração dos assistentes
const assistentes = {
    programacao: {
        nome: 'Assistente de Programação',
        emoji: '💻',
        prompt: `Você é um assistente especializado em programação e desenvolvimento de software. Dê explicações claras, com exemplos práticos em linguagens como Python e JavaScript.`
    },
    investimentos: {
        nome: 'Assistente de Investimentos',
        emoji: '💰',
        prompt: `Você é um assistente especializado em investimentos e educação financeira. Dê informações educativas, explique conceitos, mas nunca faça recomendações financeiras personalizadas.`
    },

    culinaria: {
    nome: 'Chef Virtual',
    emoji: '🍳',
    prompt: `Você é um chef virtual especializado em culinária do dia a dia. Dê dicas de preparo, explique técnicas de cozinha, sugira combinações de ingredientes e tire dúvidas sobre receitas. Nunca presuma restrições alimentares sem que o usuário informe.`
}

};

// Armazenamento de histórico
const historicos = new Map();
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${process.env.GEMINI_API_KEY}`;

// Rota principal
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Listar assistentes
app.get('/api/assistentes', (req, res) => {
    const lista = Object.keys(assistentes).map(key => ({
        id: key,
        nome: assistentes[key].nome,
        emoji: assistentes[key].emoji
    }));
    res.json(lista);
});

// Rota de chat
app.post('/api/chat', async (req, res) => {
    const { mensagem, tipoAssistente, sessionId } = req.body;

    if (!mensagem || !tipoAssistente) {
        return res.status(400).json({ erro: 'Mensagem e tipo de assistente são obrigatórios.' });
    }

    if (!assistentes[tipoAssistente]) {
        return res.status(400).json({ erro: 'Tipo de assistente inválido.' });
    }

    const sessionKey = sessionId || 'default';
    if (!historicos.has(sessionKey)) historicos.set(sessionKey, []);

    const historico = historicos.get(sessionKey);

    // Construir contexto com últimas 3 interações desse assistente
    let contextoHistorico = '';
    const ultimasInteracoes = historico.filter(h => h.tipo === tipoAssistente).slice(-3);
    if (ultimasInteracoes.length > 0) {
        contextoHistorico = '\n\nContexto da conversa anterior:\n';
        ultimasInteracoes.forEach(item => {
            contextoHistorico += `P: ${item.pergunta}\nR: ${item.resposta.substring(0, 150)}...\n\n`;
        });
    }

    const promptCompleto = `${assistentes[tipoAssistente].prompt}${contextoHistorico}\n\nPergunta atual: ${mensagem}`;

    try {
        const body = {
            contents: [
                {
                    parts: [
                        { text: promptCompleto }
                    ]
                }
            ]
        };
    
        const response = await axios.post(GEMINI_URL, body, {
            headers: { 'Content-Type': 'application/json' }
        });
    
        const candidates = response.data.candidates;
    
        if (!candidates || candidates.length === 0 || !candidates[0].content || !candidates[0].content.parts[0].text) {
            return res.status(500).json({ erro: 'A API Gemini não retornou nenhuma resposta válida. Tente novamente.' });
        }
    
        const respostaMarkdown = candidates[0].content.parts[0].text;
        const respostaHTML = marked.parse(respostaMarkdown);
    
        historico.push({
            tipo: tipoAssistente,
            pergunta: mensagem,
            resposta: respostaMarkdown,
            timestamp: new Date().toISOString()
        });
    
        if (historico.length > 50) historico.splice(0, historico.length - 50);
    
        res.json({
            respostaHTML,
            respostaMarkdown,
            assistente: assistentes[tipoAssistente].nome,
            timestamp: new Date().toISOString()
        });
    
    } catch (error) {
        console.error('Erro na API Gemini:', error.response ? error.response.data : error.message);
        res.status(500).json({ erro: 'Erro ao chamar a API Gemini.' });
    }
    
});

// Obter histórico
app.get('/api/historico/:sessionId', (req, res) => {
    const historico = historicos.get(req.params.sessionId) || [];
    res.json({ historico });
});

// Limpar histórico
app.delete('/api/historico/:sessionId', (req, res) => {
    historicos.delete(req.params.sessionId);
    res.json({ sucesso: true, mensagem: 'Histórico apagado.' });
});

// Iniciar o servidor
app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Servidor rodando em http://localhost:${PORT}`);
});
