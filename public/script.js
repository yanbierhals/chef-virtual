// Estado da aplicação
let estadoApp = {
    assistenteAtual: null,
    sessionId: gerarSessionId(),
    carregando: false
};

// Gerar ID único para a sessão
function gerarSessionId() {
    return 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

// Inicialização da aplicação
document.addEventListener('DOMContentLoaded', function() {
    carregarAssistentes();
    configurarEventListeners();
});

// Configurar event listeners
function configurarEventListeners() {
    // Enter no input de chat
    document.getElementById('chatInput').addEventListener('keypress', function(e) {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            enviarMensagem();
        }
    });

    // Fechar modal com ESC
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') {
            const modal = document.getElementById('modalHistorico');
            if (modal.style.display !== 'none') {
                toggleHistorico();
            }
        }
    });

    // Fechar modal clicando fora
    document.getElementById('modalHistorico').addEventListener('click', function(e) {
        if (e.target === this) {
            toggleHistorico();
        }
    });
}

// Carregar lista de assistentes
async function carregarAssistentes() {
    try {
        mostrarLoading(true);
        
        const response = await fetch('/api/assistentes');
        if (!response.ok) {
            throw new Error('Erro ao carregar assistentes');
        }
        
        const assistentes = await response.json();
        renderizarAssistentes(assistentes);
        
    } catch (error) {
        console.error('Erro ao carregar assistentes:', error);
        mostrarErro('Erro ao carregar assistentes. Recarregue a página.');
    } finally {
        mostrarLoading(false);
    }
}

// Renderizar lista de assistentes
function renderizarAssistentes(assistentes) {
    const container = document.getElementById('assistentesList');
    container.innerHTML = '';
    
    assistentes.forEach(assistente => {
        const elemento = document.createElement('div');
        elemento.className = 'assistente-item';
        elemento.onclick = () => selecionarAssistente(assistente.id, assistente.nome, assistente.emoji);
        
        elemento.innerHTML = `
            <span class="assistente-emoji">${assistente.emoji}</span>
            <span class="assistente-nome">${assistente.nome}</span>
        `;
        
        container.appendChild(elemento);
    });
}

// Selecionar assistente
function selecionarAssistente(id, nome, emoji) {
    // Remover seleção anterior
    document.querySelectorAll('.assistente-item').forEach(item => {
        item.classList.remove('active');
    });
    
    // Adicionar seleção atual
    event.currentTarget.classList.add('active');
    
    // Atualizar estado
    estadoApp.assistenteAtual = id;
    
    // Atualizar interface
    const assistenteAtual = document.getElementById('assistenteAtual');
    assistenteAtual.innerHTML = `
        <i class="fas fa-robot"></i>
        <span>${emoji} ${nome}</span>
    `;
    
    // Habilitar input
    const chatInput = document.getElementById('chatInput');
    const sendButton = document.getElementById('sendButton');
    
    chatInput.disabled = false;
    chatInput.placeholder = `Digite sua mensagem para o ${nome}...`;
    sendButton.disabled = false;
    
    // Limpar mensagem de boas-vindas se existir
    const welcomeMessage = document.querySelector('.message-welcome');
    if (welcomeMessage) {
        welcomeMessage.style.display = 'none';
    }
    
    // Focar no input
    chatInput.focus();
    
    // Mostrar mensagem de ativação
    adicionarMensagemSistema(`${emoji} ${nome} ativado! Como posso ajudá-lo hoje?`);
}

// Enviar mensagem
async function enviarMensagem() {
    const input = document.getElementById('chatInput');
    const mensagem = input.value.trim();
    
    if (!mensagem || !estadoApp.assistenteAtual || estadoApp.carregando) {
        return;
    }
    
    // Limpar input
    input.value = '';
    
    // Adicionar mensagem do usuário
    adicionarMensagem('user', mensagem);
    
    // Mostrar indicador de digitação
    mostrarIndicadorDigitacao(true);
    
    try {
        estadoApp.carregando = true;
        
        const response = await fetch('/api/chat', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                mensagem: mensagem,
                tipoAssistente: estadoApp.assistenteAtual,
                sessionId: estadoApp.sessionId
            })
        });
        
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.erro || 'Erro na comunicação com o servidor');
        }
        
        const data = await response.json();
        
        // Adicionar resposta do assistente
        adicionarMensagem('assistant', data.respostaHTML || data.resposta);
        
    } catch (error) {
        console.error('Erro ao enviar mensagem:', error);
        adicionarMensagem('assistant', `Desculpe, ocorreu um erro: ${error.message}. Tente novamente.`);
    } finally {
        estadoApp.carregando = false;
        mostrarIndicadorDigitacao(false);
    }
}

// Adicionar mensagem ao chat
function adicionarMensagem(tipo, conteudo) {
    const chatMessages = document.getElementById('chatMessages');
    const agora = new Date();
    
    const messageElement = document.createElement('div');
    messageElement.className = `message ${tipo}`;
    
    const avatar = tipo === 'user' ? 
        '<i class="fas fa-user"></i>' : 
        '<i class="fas fa-robot"></i>';
    
    const tempo = agora.toLocaleTimeString('pt-BR', { 
        hour: '2-digit', 
        minute: '2-digit' 
    });
    
    messageElement.innerHTML = `
        <div class="message-avatar">
            ${avatar}
        </div>
        <div class="message-content">
            <div class="message-bubble">
                ${formatarMensagem(conteudo)}
            </div>
            <div class="message-time">${tempo}</div>
        </div>
    `;
    
    chatMessages.appendChild(messageElement);
    
    // Scroll para a última mensagem
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

// Adicionar mensagem do sistema
function adicionarMensagemSistema(conteudo) {
    const chatMessages = document.getElementById('chatMessages');
    
    const messageElement = document.createElement('div');
    messageElement.className = 'message system';
    messageElement.style.textAlign = 'center';
    messageElement.style.margin = '16px 0';
    messageElement.style.color = 'var(--text-secondary)';
    messageElement.style.fontSize = '0.875rem';
    messageElement.style.fontStyle = 'italic';
    
    messageElement.innerHTML = `
        <div style="padding: 8px 16px; background: var(--bg-secondary); border-radius: var(--border-radius); display: inline-block;">
            ${conteudo}
        </div>
    `;
    
    chatMessages.appendChild(messageElement);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

// Formatar mensagem (básico)
function formatarMensagem(texto) {
    // Converter quebras de linha
    texto = texto.replace(/\n/g, '<br>');
    
    // Destacar código entre crases
    texto = texto.replace(/`([^`]+)`/g, '<code style="background: var(--bg-tertiary); padding: 2px 4px; border-radius: 4px; font-family: monospace;">$1</code>');
    
    // Destacar texto em negrito
    texto = texto.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    
    return texto;
}

// Mostrar/ocultar indicador de digitação
function mostrarIndicadorDigitacao(mostrar) {
    const indicator = document.getElementById('typingIndicator');
    indicator.style.display = mostrar ? 'flex' : 'none';
}

// Mostrar/ocultar loading
function mostrarLoading(mostrar) {
    const overlay = document.getElementById('loadingOverlay');
    overlay.style.display = mostrar ? 'flex' : 'none';
}

// Mostrar erro
function mostrarErro(mensagem) {
    // Implementação simples - pode ser melhorada com toast/notification
    alert(mensagem);
}

// Limpar chat
function limparChat() {
    if (confirm('Tem certeza que deseja limpar o chat atual?')) {
        const chatMessages = document.getElementById('chatMessages');
        chatMessages.innerHTML = '';
        
        // Gerar nova sessão
        estadoApp.sessionId = gerarSessionId();
        
        // Mostrar mensagem de confirmação
        adicionarMensagemSistema('Chat limpo! Você pode começar uma nova conversa.');
    }
}

// Toggle modal de histórico
function toggleHistorico() {
    const modal = document.getElementById('modalHistorico');
    const isVisible = modal.style.display !== 'none';
    
    if (isVisible) {
        modal.style.display = 'none';
    } else {
        modal.style.display = 'flex';
        carregarHistorico();
    }
}

// Carregar histórico
async function carregarHistorico() {
    const content = document.getElementById('historicoContent');
    content.innerHTML = '<p>Carregando histórico...</p>';
    
    try {
        const response = await fetch(`/api/historico/${estadoApp.sessionId}`);
        if (!response.ok) {
            throw new Error('Erro ao carregar histórico');
        }
        
        const data = await response.json();
        renderizarHistorico(data.historico);
        
    } catch (error) {
        console.error('Erro ao carregar histórico:', error);
        content.innerHTML = '<p>Erro ao carregar histórico.</p>';
    }
}

// Renderizar histórico
function renderizarHistorico(historico) {
    const content = document.getElementById('historicoContent');
    
    if (historico.length === 0) {
        content.innerHTML = '<p>Nenhuma conversa registrada nesta sessão.</p>';
        return;
    }
    
    content.innerHTML = '';
    
    historico.forEach((item, index) => {
        const elemento = document.createElement('div');
        elemento.className = 'historico-item';
        
        const data = new Date(item.timestamp);
        const tempoFormatado = data.toLocaleString('pt-BR');
        
        elemento.innerHTML = `
            <div class="historico-header">
                <span class="historico-tipo">${item.tipo.charAt(0).toUpperCase() + item.tipo.slice(1)}</span>
                <span class="historico-time">${tempoFormatado}</span>
            </div>
            <div class="historico-pergunta"><strong>P:</strong> ${item.pergunta}</div>
            <div class="historico-resposta"><strong>R:</strong> ${item.resposta}</div>
        `;
        
        content.appendChild(elemento);
    });
}

// Limpar histórico
async function limparHistorico() {
    if (!confirm('Tem certeza que deseja limpar todo o histórico desta sessão?')) {
        return;
    }
    
    try {
        const response = await fetch(`/api/historico/${estadoApp.sessionId}`, {
            method: 'DELETE'
        });
        
        if (!response.ok) {
            throw new Error('Erro ao limpar histórico');
        }
        
        // Atualizar exibição
        carregarHistorico();
        
        // Mostrar confirmação
        alert('Histórico limpo com sucesso!');
        
    } catch (error) {
        console.error('Erro ao limpar histórico:', error);
        alert('Erro ao limpar histórico. Tente novamente.');
    }
}

// Utilitários para debug (remover em produção)
window.debugApp = {
    estado: () => estadoApp,
    limparTudo: () => {
        localStorage.clear();
        sessionStorage.clear();
        location.reload();
    }
};

