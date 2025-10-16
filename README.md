# 🎵 Wavoip Frontend - Sistema de Injeção Automática de Áudio

Um frontend moderno e compacto para integração com a API Wavoip, com sistema de injeção automática de áudio em chamadas WhatsApp.

## ✨ Funcionalidades

### 🎯 **Sistema de Injeção Automática de Áudio**
- ✅ **Injeção automática** durante chamadas sem intervenção manual
- ✅ **Interceptação global** do `getUserMedia` para substituir microfone por áudio MP3
- ✅ **Timing perfeito** - stream preparado antes da chamada ser aceita
- ✅ **Dupla proteção** - interceptação principal + backup direto
- ✅ **Múltiplas estratégias** de injeção funcionando em paralelo

### 📞 **Gerenciamento de Chamadas**
- ✅ **Inicialização automática** de dispositivos Wavoip
- ✅ **Chamadas diretas** para números de telefone
- ✅ **Monitoramento em tempo real** do status das chamadas
- ✅ **Controle completo** - aceitar, rejeitar, finalizar chamadas

### 🎵 **Sistema de Áudio Avançado**
- ✅ **Upload de arquivos** MP3, WAV, OGG, M4A, AAC
- ✅ **Reprodução automática** quando chamada é aceita
- ✅ **Substituição de microfone** por áudio do arquivo
- ✅ **Múltiplas estratégias** de captura e reprodução
- ✅ **Controle de volume** e qualidade de áudio

### 🎨 **Interface Moderna**
- ✅ **Design glassmorphism** com efeitos de vidro
- ✅ **Layout responsivo** com header dedicado
- ✅ **Interface compacta** otimizada para máxima eficiência
- ✅ **Logs em tempo real** com sistema de cores
- ✅ **Botões de ícone** para ações rápidas

## 🚀 Instalação

### Pré-requisitos
- Node.js 16+ 
- npm ou yarn
- Navegador moderno com suporte a WebRTC

### Instalação
```bash
# Clone o repositório
git clone https://github.com/seu-usuario/wavoip.git
cd wavoip

# Instale as dependências
npm install

# Inicie o servidor de desenvolvimento
npm start
```

O projeto estará disponível em `http://localhost:3000`

## 📋 Como Usar

### 1. **Configuração Inicial**
1. Adicione seus **tokens de dispositivo** Wavoip
2. Adicione **números de telefone** para chamadas
3. Faça **upload de um arquivo de áudio** (MP3, WAV, etc.)

### 2. **Inicialização dos Dispositivos**
1. Clique em **"Inicializar Conexões"**
2. Aguarde os dispositivos ficarem **online**
3. Verifique o status na seção "Status dos Dispositivos"

### 3. **Fazer Chamadas**
1. Selecione um dispositivo **online**
2. Clique no botão de **telefone** ao lado do número desejado
3. O sistema **automaticamente injetará o áudio** quando a chamada for aceita

### 4. **Monitoramento**
- Acompanhe os **logs em tempo real** no painel direito
- Monitore o **status da chamada** (outcoming_calling → accept)
- Verifique se o **áudio está sendo reproduzido**

## 🔧 Funcionalidades Técnicas

### **Sistema de Interceptação**
```javascript
// Interceptação global do getUserMedia
navigator.mediaDevices.getUserMedia = async function(constraints) {
  if (constraints.audio && window.currentMP3Stream) {
    return window.currentMP3Stream; // Retorna stream do MP3
  }
  return window.originalGetUserMedia.call(this, constraints);
};
```

### **Injeção Automática**
- **Durante `outcoming_calling`**: Stream MP3 preparado
- **Durante `accept`**: Source iniciado automaticamente
- **Interceptação ativa**: Biblioteca recebe áudio do MP3

### **Múltiplas Estratégias**
1. **Interceptação global** (principal)
2. **Substituição direta** de microfone
3. **Captura forçada** com configurações específicas
4. **Reprodução simples** via AudioContext
5. **Reprodução HTML** otimizada

## 📁 Estrutura do Projeto

```
src/
├── App.js          # Componente principal com toda lógica
├── App.css         # Estilos modernos com glassmorphism
├── index.js        # Ponto de entrada da aplicação
└── index.css       # Estilos globais

public/
├── index.html      # Template HTML
└── manifest.json   # Manifesto PWA
```

## 🎨 Interface

### **Layout Principal**
- **Header fixo** com título e efeito glassmorphism
- **Painéis laterais** - controles à esquerda, logs à direita
- **Cards compactos** com informações organizadas

### **Seções Disponíveis**
1. **Upload de Arquivo** - Upload de áudio
2. **Tokens dos Dispositivos** - Gerenciamento de tokens
3. **Números de Telefone** - Lista de números
4. **Status dos Dispositivos** - Monitoramento em tempo real
5. **Informações da Chamada** - Detalhes da chamada ativa
6. **Logs** - Sistema de logs em tempo real

## 🔍 Logs e Debugging

### **Sistema de Logs Colorido**
- 🔵 **Info** - Informações gerais
- 🟢 **Success** - Operações bem-sucedidas  
- 🟡 **Warning** - Avisos importantes
- 🔴 **Error** - Erros que precisam atenção

### **Logs Importantes**
```
🎤 getUserMedia chamado pela interceptação
🎤 Interceptando getUserMedia - retornando stream do MP3
🎯 Source pendente iniciado - chamada aceita!
🎵 Áudio transmitido na ligação!
```

## ⚙️ Configurações

### **Variáveis de Ambiente**
Crie um arquivo `.env` na raiz do projeto:
```env
REACT_APP_WAVOIP_API_URL=https://sua-api-wavoip.com
REACT_APP_DEBUG_MODE=true
```

### **Configurações de Áudio**
- **Sample Rate**: 48000Hz
- **Channels**: 2 (estéreo)
- **Latency**: 0.01s
- **Formatos suportados**: MP3, WAV, OGG, M4A, AAC

## 🐛 Troubleshooting

### **Problemas Comuns**

**1. Áudio não é transmitido:**
- Verifique se a interceptação está ativa nos logs
- Confirme se o arquivo de áudio foi carregado
- Verifique se o dispositivo está online

**2. Chamada não conecta:**
- Verifique se o token é válido
- Confirme se o número está correto
- Verifique a conexão de internet

**3. Erro de getUserMedia:**
- Permita acesso ao microfone no navegador
- Verifique se o HTTPS está habilitado
- Teste em navegador diferente

### **Logs de Debug**
Ative o modo debug para logs detalhados:
```javascript
// No console do navegador
localStorage.setItem('debug', 'true');
```

## 🤝 Contribuição

1. Fork o projeto
2. Crie uma branch para sua feature (`git checkout -b feature/AmazingFeature`)
3. Commit suas mudanças (`git commit -m 'Add some AmazingFeature'`)
4. Push para a branch (`git push origin feature/AmazingFeature`)
5. Abra um Pull Request

## 📄 Licença

Este projeto está sob a licença MIT. Veja o arquivo `LICENSE` para mais detalhes.

## 🙏 Agradecimentos

- **Wavoip API** - Plataforma de comunicação WhatsApp
- **React** - Framework frontend
- **Lucide React** - Ícones modernos
- **React Hot Toast** - Notificações elegantes

## 📞 Suporte

Para suporte técnico ou dúvidas:
- 📧 Email: seu-email@exemplo.com
- 💬 Discord: SeuDiscord#1234
- 🐛 Issues: [GitHub Issues](https://github.com/seu-usuario/wavoip/issues)

---

**Desenvolvido com ❤️ para automatizar injeção de áudio em chamadas WhatsApp**