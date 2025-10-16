import React, { useState, useEffect, useRef } from 'react';
import Wavoip from 'wavoip-api';
import { useDropzone } from 'react-dropzone';
import { 
  Phone, 
  PhoneOff, 
  Upload, 
  Trash2, 
  Plus, 
  X, 
  Play, 
  Pause, 
  Volume2,
  AlertCircle,
  CheckCircle,
  Clock,
  Shield
} from 'lucide-react';
import toast, { Toaster } from 'react-hot-toast';
import './App.css';

function App() {
  // Estados principais
  const [tokens, setTokens] = useState([]);
  const [phoneNumbers, setPhoneNumbers] = useState([]);
  const [uploadedFile, setUploadedFile] = useState(null);
  const [wavoipInstances, setWavoipInstances] = useState({});
  const [devices, setDevices] = useState([]);
  const [isConnecting, setIsConnecting] = useState(false);
  const [logs, setLogs] = useState([]);
  const [audioContext, setAudioContext] = useState(null);
  const [audioBuffer, setAudioBuffer] = useState(null);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [currentCall, setCurrentCall] = useState(null);
  const [callInfo, setCallInfo] = useState({
    id: null,
    duration: 0,
    tag: null,
    phone: null,
    picture_profile: null,
    status: null,
    direction: null,
    whatsapp_instance: null,
    active_start_date: null,
    chat_id: null,
    inbox_name: null,
  });

  // Refs
  const fileInputRef = useRef(null);
  const activeAudioSources = useRef([]);
  const activeAudioElements = useRef([]);

  // Effect para monitorar mudanças no callInfo e reproduzir áudio automaticamente
  useEffect(() => {
    addLog(`🔍 useEffect executado - callInfo.status: ${callInfo.status}`, 'info');
    addLog(`🔍 useEffect executado - callInfo.whatsapp_instance: ${callInfo.whatsapp_instance}`, 'info');
    addLog(`🔍 useEffect executado - uploadedFile: ${uploadedFile ? 'EXISTE' : 'NÃO EXISTE'}`, 'info');
    addLog(`🔍 useEffect executado - wavoipInstances: ${Object.keys(wavoipInstances).length} instâncias`, 'info');
    
    if (callInfo.status === 'accept' && callInfo.whatsapp_instance && uploadedFile) {
      addLog(`🎵 useEffect detectou chamada aceita, reproduzindo áudio...`, 'info');
      addLog(`🎵 Condições atendidas: status=accept, instance=${callInfo.whatsapp_instance}, file=${uploadedFile.name}`, 'info');
      
      // Aguardar as instâncias estarem disponíveis
      const waitForInstances = () => {
        if (wavoipInstances[callInfo.whatsapp_instance]) {
          addLog(`✅ Instância encontrada, reproduzindo áudio...`, 'success');
          setTimeout(() => {
            // Primeiro testar se o áudio funciona
            testAudioPlayback();
            // Depois tentar substituir microfone por MP3 (iniciar imediatamente - interceptação já ativa)
            setTimeout(() => {
              replaceMicrophoneWithMP3(callInfo.whatsapp_instance, true);
            }, 500);
            // Iniciar source pendente se existir
            setTimeout(() => {
              startPendingAudioSource();
            }, 1000);
            // Depois tentar captura forçada
            setTimeout(() => {
              forceMicrophoneCapture(callInfo.whatsapp_instance);
            }, 2000);
            // Depois tentar reprodução simples
            setTimeout(() => {
              playAudioSimple(callInfo.whatsapp_instance);
            }, 3000);
            // Por último, tentar HTML otimizado
            setTimeout(() => {
              playAudioWithHTMLOptimized(callInfo.whatsapp_instance);
            }, 4000);
          }, 1000);
        } else {
          addLog(`⏳ Aguardando instância estar disponível...`, 'info');
          setTimeout(waitForInstances, 500);
        }
      };
      
      waitForInstances();
    }
  }, [callInfo.status, callInfo.whatsapp_instance, uploadedFile, wavoipInstances]);

  // Effect para limpar áudio quando componente for desmontado
  useEffect(() => {
    return () => {
      stopAllAudio();
    };
  }, []);

  // Effect para capturar erros globais não tratados
  useEffect(() => {
    const handleUnhandledRejection = (event) => {
      if (event.reason && event.reason.message && event.reason.message.includes('off')) {
        addLog(`Erro capturado: ${event.reason.message}`, 'error');
        event.preventDefault(); // Prevenir que o erro apareça no console
      }
    };

    const handleError = (event) => {
      if (event.error && event.error.message && event.error.message.includes('off')) {
        addLog(`Erro capturado: ${event.error.message}`, 'error');
        event.preventDefault();
      }
    };

    window.addEventListener('unhandledrejection', handleUnhandledRejection);
    window.addEventListener('error', handleError);

    return () => {
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
      window.removeEventListener('error', handleError);
    };
  }, []);

  // Função para adicionar logs
  const addLog = (message, type = 'info') => {
    const timestamp = new Date().toLocaleTimeString();
    setLogs(prev => [...prev, { message, type, timestamp }]);
  };

  // Função auxiliar para gerenciar sources de áudio
  const addAudioSource = (source) => {
    activeAudioSources.current.push(source);
    addLog(`🎵 Source adicionado ao controle (total: ${activeAudioSources.current.length})`, 'info');
  };

  const removeAudioSource = (source) => {
    activeAudioSources.current = activeAudioSources.current.filter(s => s !== source);
    addLog(`🎵 Source removido do controle (total: ${activeAudioSources.current.length})`, 'info');
  };

  // Funções auxiliares para gerenciar elementos de áudio HTML
  const addAudioElement = (element) => {
    activeAudioElements.current.push(element);
    addLog(`🎵 Elemento HTML adicionado ao controle (total: ${activeAudioElements.current.length})`, 'info');
    addLog(`🔍 DEBUG: Elemento adicionado - existe: ${!!element}, tem pause: ${typeof element.pause === 'function'}`, 'info');
  };

  const removeAudioElement = (element) => {
    activeAudioElements.current = activeAudioElements.current.filter(e => e !== element);
    addLog(`🎵 Elemento HTML removido do controle (total: ${activeAudioElements.current.length})`, 'info');
  };

  // Função para configurar interceptação global do getUserMedia
  const setupGlobalAudioInterception = () => {
    try {
      addLog('🔧 Configurando interceptação global do getUserMedia...', 'info');
      
      // Salvar referência original se ainda não foi salva
      if (!window.originalGetUserMedia) {
        window.originalGetUserMedia = navigator.mediaDevices.getUserMedia;
        addLog('💾 getUserMedia original salvo', 'info');
      }
      
      // Interceptar getUserMedia
      navigator.mediaDevices.getUserMedia = async function(constraints) {
        addLog('🎤 getUserMedia chamado pela interceptação', 'info');
        addLog(`🎤 Constraints: ${JSON.stringify(constraints)}`, 'info');
        addLog(`🎤 Tem audio: ${constraints.audio ? 'SIM' : 'NÃO'}`, 'info');
        addLog(`🎤 Stream MP3 disponível: ${window.currentMP3Stream ? 'SIM' : 'NÃO'}`, 'info');
        addLog(`🎤 CallInfo status: ${callInfo.status}`, 'info');
        
        if (constraints.audio && window.currentMP3Stream) {
          addLog('🎤 Interceptando getUserMedia - retornando stream do MP3', 'success');
          addLog(`🎤 Stream ID: ${window.currentMP3Stream.getTracks()[0]?.id}`, 'info');
          return window.currentMP3Stream;
        }
        
        addLog('🎤 Usando getUserMedia original', 'info');
        return window.originalGetUserMedia.call(this, constraints);
      };
      
      // Marcar interceptação como ativa
      window.getUserMediaIntercepted = true;
      addLog('🎤 Interceptação global configurada e ATIVA', 'success');
      addLog(`🎤 Verificação: getUserMediaIntercepted = ${window.getUserMediaIntercepted}`, 'info');
      
    } catch (error) {
      addLog(`Erro ao configurar interceptação: ${error.message}`, 'error');
    }
  };

  // Função auxiliar para chamar métodos do socket com validação
  const safeSocketCall = (socket, method, ...args) => {
    try {
      if (socket && typeof socket[method] === 'function') {
        return socket[method](...args);
      } else {
        addLog(`⚠️ Socket ou método ${method} não disponível`, 'warning');
        return null;
      }
    } catch (error) {
      addLog(`❌ Erro ao chamar ${method}: ${error.message}`, 'error');
      return null;
    }
  };

  // Função para inicializar Wavoip (baseada no exemplo Vue)
  const initializeWavoip = async () => {
    if (tokens.length === 0) {
      toast.error('Adicione pelo menos um token');
      return;
    }

    setIsConnecting(true);
    addLog('Inicializando conexão Wavoip...', 'info');

    try {
      // Configurar interceptação global ANTES de conectar
      setupGlobalAudioInterception();

      for (const token of tokens) {
        if (wavoipInstances[token]) {
          continue;
        }

        try {
          const WAV = new Wavoip();
          const whatsapp_instance = await WAV.connect(token);

          // Verificar se a instância e socket são válidos
          if (!whatsapp_instance) {
            throw new Error('Falha ao conectar - instância não criada');
          }

          // Configurar eventos de signaling
          if (whatsapp_instance && whatsapp_instance.socket) {
            // Remover listener anterior de forma segura
            safeSocketCall(whatsapp_instance.socket, 'off', 'signaling');
            
            // Adicionar novo listener de forma segura
            const socket = whatsapp_instance.socket;
            if (socket && typeof socket.on === 'function') {
              try {
                socket.on('signaling', (...args) => {
              const data = args[0];
              addLog(`Signaling data: ${JSON.stringify(data)}`, 'info');

            if (data?.tag === 'offer') {
              const name = data?.content?.from_tag;
              const whatsapp_id = data?.content?.phone;
              const profile_picture = data?.content?.profile_picture;
              
              setCallInfo({
                id: token,
                duration: 0,
                tag: name,
                phone: whatsapp_id,
                picture_profile: profile_picture,
                status: 'offer',
                direction: 'incoming',
                whatsapp_instance: token,
                inbox_name: `Dispositivo ${tokens.indexOf(token) + 1}`,
                chat_id: null,
              });
              
              toast.success(`Chamada recebida de ${name || whatsapp_id}`);
            } else if (data?.tag === 'terminate') {
              setCallInfo(prev => ({ ...prev, status: 'terminate' }));
              stopAllAudio(); // Parar áudio quando chamada terminar
              addLog('📞 Chamada finalizada, parando áudio', 'info');
              setTimeout(() => {
                setCallInfo({
                  id: null,
                  duration: 0,
                  tag: null,
                  phone: null,
                  picture_profile: null,
                  status: null,
                  direction: null,
                  whatsapp_instance: null,
                  active_start_date: null,
                  inbox_name: null,
                  chat_id: null,
                });
              }, 250);
            } else if (data?.tag === 'reject') {
              setCallInfo(prev => ({ ...prev, status: 'reject' }));
              stopAllAudio(); // Parar áudio quando chamada for rejeitada
              setTimeout(() => {
                setCallInfo({
                  id: null,
                  duration: 0,
                  tag: null,
                  phone: null,
                  picture_profile: null,
                  status: null,
                  direction: null,
                  whatsapp_instance: null,
                  active_start_date: null,
                  inbox_name: null,
                  chat_id: null,
                });
              }, 250);
            } else if (data?.tag === 'accept') {
              addLog(`🎯 Evento accept recebido para token: ${token.substring(0, 8)}...`, 'info');
              addLog(`🔍 Instâncias disponíveis: ${Object.keys(wavoipInstances).join(', ')}`, 'info');
              
              setCallInfo(prev => ({ 
                ...prev, 
                status: 'accept',
                active_start_date: new Date(),
                whatsapp_instance: token // Garantir que o token está definido
              }));
              
              // O useEffect vai detectar a mudança e reproduzir o áudio automaticamente
            }
                });
              } catch (onError) {
                addLog(`Erro ao configurar listener signaling: ${onError.message}`, 'error');
              }
            } else {
              addLog(`Socket não disponível para token ${token.substring(0, 8)}...`, 'warning');
            }
          } else {
            addLog(`Socket não disponível para token ${token.substring(0, 8)}...`, 'warning');
          }

          // Adicionar instância ao estado
          setWavoipInstances(prev => {
            const newInstances = {
              ...prev,
              [token]: {
                whatsapp_instance,
                inbox_name: `Dispositivo ${tokens.indexOf(token) + 1}`,
                token: token
              }
            };
            addLog(`Instância adicionada para token: ${token.substring(0, 8)}...`, 'success');
            addLog(`Total de instâncias: ${Object.keys(newInstances).length}`, 'info');
            return newInstances;
          });

          // Configurar eventos de conexão
          if (whatsapp_instance && whatsapp_instance.socket) {
            const socket = whatsapp_instance.socket;
            
            try {
              // Evento de conexão
              if (typeof socket.on === 'function') {
                socket.on('connect', () => {
                  addLog(`Dispositivo ${token.substring(0, 8)}... conectado`, 'success');
                  setDevices(prev => [...prev.filter(d => d.token !== token), {
                    token,
                    status: 'online',
                    inbox_name: `Dispositivo ${tokens.indexOf(token) + 1}`
                  }]);
                });

                socket.on('disconnect', () => {
                  addLog(`Dispositivo ${token.substring(0, 8)}... desconectado`, 'warning');
                  setDevices(prev => prev.map(d => 
                    d.token === token ? { ...d, status: 'offline' } : d
                  ));
                  // Parar áudio quando desconectar
                  stopAllAudio();
                  // Limpar instância
                  cleanupWavoipInstance(token);
                });
              } else {
                addLog(`Método on não disponível no socket para token ${token.substring(0, 8)}...`, 'warning');
              }
            } catch (socketError) {
              addLog(`Erro ao configurar eventos de socket: ${socketError.message}`, 'error');
            }
          } else {
            addLog(`Socket não disponível ou inválido para token ${token.substring(0, 8)}...`, 'warning');
          }

          addLog(`Token ${token.substring(0, 8)}... inicializado`, 'success');

        } catch (error) {
          addLog(`Erro ao conectar token ${token.substring(0, 8)}...: ${error.message}`, 'error');
        }
      }

      toast.success('Conexões estabelecidas!');
      
    } catch (error) {
      addLog(`Erro geral ao inicializar Wavoip: ${error.message}`, 'error');
      toast.error('Erro ao conectar com Wavoip');
    } finally {
      setIsConnecting(false);
    }
  };

  // Função para realizar chamada (baseada no exemplo Vue)
  const makeCall = async (token, phoneNumber) => {
    addLog(`📞 makeCall iniciada para ${phoneNumber}`, 'info');
    addLog(`📞 Token: ${token.substring(0, 10)}...`, 'info');
    addLog(`📞 Interceptação ativa: ${window.getUserMediaIntercepted ? 'SIM' : 'NÃO'}`, 'info');
    addLog(`📞 Stream MP3 atual: ${window.currentMP3Stream ? 'EXISTE' : 'NÃO EXISTE'}`, 'info');
    
    if (!wavoipInstances || !wavoipInstances[token]) {
      toast.error('Dispositivo não está conectado');
      return;
    }

    if (!uploadedFile) {
      toast.error('Nenhum arquivo de áudio carregado');
      return;
    }

    try {
      addLog(`Iniciando chamada para ${phoneNumber}...`, 'info');
      
      // Reativar interceptação global antes da chamada
      addLog('🔧 Reativando interceptação global antes da chamada...', 'info');
      setupGlobalAudioInterception();
      
      const wavoip = wavoipInstances[token].whatsapp_instance;
      
      if (!wavoip || typeof wavoip.callStart !== 'function') {
        toast.error('Instância Wavoip inválida');
        return;
      }
      
      const response = await wavoip.callStart({ whatsappid: phoneNumber });

      if (response.type !== 'success') {
        throw new Error(response?.result || 'Erro desconhecido');
      }

      const profile_picture = response?.result?.profile_picture;

      setCallInfo({
        id: token,
        duration: 0,
        tag: 'Ligação Direta',
        phone: phoneNumber,
        picture_profile: profile_picture,
        status: 'outcoming_calling',
        direction: 'outcoming',
        whatsapp_instance: token,
        inbox_name: wavoipInstances[token].inbox_name,
        chat_id: null,
      });

      addLog(`Chamada iniciada para ${phoneNumber}`, 'success');
      toast.success('Chamada iniciada!');

      // INJEÇÃO AUTOMÁTICA DURANTE outcoming_calling
      if (uploadedFile) {
        addLog(`🎯 Iniciando injeção automática durante outcoming_calling...`, 'info');
        
        // Aguardar um pouco para a chamada se estabelecer
        setTimeout(() => {
          addLog(`🎵 Executando injeção de áudio durante outcoming_calling...`, 'info');
          replaceMicrophoneWithMP3(token, false); // Não iniciar imediatamente, aguardar chamada aceita
        }, 1000);
      }

      // Monitorar quando a chamada for aceita para reproduzir áudio automaticamente
      const checkCallStatus = () => {
        // Verificar o estado atual do callInfo
        setCallInfo(currentCallInfo => {
          if (currentCallInfo.status === 'accept') {
            addLog(`🎯 Chamada aceita - áudio já deve estar injetado`, 'success');
            return currentCallInfo;
          } else if (currentCallInfo.status === 'outcoming_calling') {
            // Continuar verificando até a chamada ser aceita
            setTimeout(checkCallStatus, 100);
          }
          return currentCallInfo;
        });
      };
      
      // Iniciar verificação após 500 ms
      setTimeout(checkCallStatus, 100);

    } catch (error) {
      addLog(`Erro ao iniciar chamada: ${error.message}`, 'error');
      toast.error('Erro ao iniciar chamada');
    }
  };

  // Função para adicionar token
  const addToken = () => {
    const newToken = prompt('Digite o token do dispositivo:');
    if (newToken && newToken.trim()) {
      setTokens(prev => [...prev, newToken.trim()]);
      addLog(`Token adicionado: ${newToken.substring(0, 8)}...`, 'success');
    }
  };

  // Função para remover token
  const removeToken = (index) => {
    const token = tokens[index];
    setTokens(prev => prev.filter((_, i) => i !== index));
    addLog(`Token removido: ${token.substring(0, 8)}...`, 'warning');
  };

  // Função para adicionar número de telefone
  const addPhoneNumber = () => {
    const newNumber = prompt('Digite o número de telefone (com código do país):');
    if (newNumber && newNumber.trim()) {
      setPhoneNumbers(prev => [...prev, newNumber.trim()]);
      addLog(`Número adicionado: ${newNumber}`, 'success');
    }
  };

  // Função para remover número de telefone
  const removePhoneNumber = (index) => {
    const number = phoneNumbers[index];
    setPhoneNumbers(prev => prev.filter((_, i) => i !== index));
    addLog(`Número removido: ${number}`, 'warning');
  };

  // Configuração do dropzone para upload de arquivo
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: {
      'audio/*': ['.mp3', '.wav', '.ogg', '.m4a', '.aac']
    },
    onDrop: (acceptedFiles) => {
      if (acceptedFiles.length > 0) {
        const file = acceptedFiles[0];
        setUploadedFile(file);
        addLog(`Arquivo carregado: ${file.name}`, 'success');
        
        // Carregar arquivo de áudio
        loadAudioFile(file);
      }
    },
    noClick: false, // Permitir clique na área
    noKeyboard: false // Permitir teclado
  });

  // Função para abrir seletor de arquivos
  const openFileDialog = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  // Função para carregar arquivo de áudio
  const loadAudioFile = async (file) => {
    try {
      const arrayBuffer = await file.arrayBuffer();
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
      
      setAudioContext(audioContext);
      setAudioBuffer(audioBuffer);
      
      addLog(`Arquivo de áudio carregado com sucesso: ${file.name}`, 'success');
    } catch (error) {
      addLog(`Erro ao carregar arquivo de áudio: ${error.message}`, 'error');
      toast.error('Erro ao carregar arquivo de áudio');
    }
  };

  // Função para iniciar source pendente quando chamada for aceita
  const startPendingAudioSource = () => {
    addLog('🎯 startPendingAudioSource() chamada', 'info');
    addLog(`🎯 Source pendente existe: ${window.pendingAudioSource ? 'SIM' : 'NÃO'}`, 'info');
    addLog(`🎯 CallInfo status: ${callInfo.status}`, 'info');
    addLog(`🎯 CallInfo whatsapp_instance: ${callInfo.whatsapp_instance}`, 'info');
    
    if (window.pendingAudioSource) {
      try {
        addLog('🎯 Iniciando source pendente...', 'info');
        window.pendingAudioSource.start();
        setIsPlayingAudio(true);
        addLog('🎵 Source pendente iniciado - chamada aceita!', 'success');
        addLog(`🎯 isPlayingAudio definido como: ${true}`, 'info');
        window.pendingAudioSource = null; // Limpar referência
        addLog('🎯 Referência do source pendente limpa', 'info');
      } catch (startError) {
        addLog(`Erro ao iniciar source pendente: ${startError.message}`, 'error');
        addLog(`🎯 Erro detalhado: ${startError.stack}`, 'error');
        window.pendingAudioSource = null;
      }
    } else {
      addLog('🎯 Nenhum source pendente encontrado', 'warning');
    }
  };

  // Função para substituir microfone por áudio do MP3 (versão com interceptação global)
  const replaceMicrophoneWithMP3 = async (token, shouldStartImmediately = true) => {
    try {
      addLog('🎤 Substituindo microfone por áudio do MP3...', 'info');
      
      if (!audioContext || !audioBuffer) {
        addLog('❌ AudioContext ou AudioBuffer não disponível', 'error');
        return;
      }

      if (!wavoipInstances || !wavoipInstances[token]) {
        addLog('❌ Instância Wavoip não encontrada', 'error');
        return;
      }

      const wavoip = wavoipInstances[token].whatsapp_instance;
      
      if (!wavoip) {
        addLog('❌ Instância Wavoip inválida', 'error');
        return;
      }
      
      // Garantir que o AudioContext esteja ativo
      if (audioContext.state === 'suspended') {
        addLog('🔄 AudioContext suspenso, tentando retomar...', 'info');
        await audioContext.resume();
        addLog(`✅ AudioContext retomado: ${audioContext.state}`, 'success');
      }

      // Criar stream de áudio robusto
      const { source, audioStream, audioTrack, gainNode } = await createRobustAudioStream(audioBuffer);
      
      addLog('🎵 Stream de áudio MP3 criado', 'success');
      addLog(`🎵 Track ID: ${audioTrack.id}`, 'info');
      addLog(`🎵 Track label: ${audioTrack.label}`, 'info');
      addLog(`🎵 Track enabled: ${audioTrack.enabled}`, 'info');
      
      if (!audioTrack) {
        addLog('❌ Nenhuma track de áudio encontrada', 'error');
        return;
      }

      // ESTRATÉGIA: Usar interceptação global já configurada
      addLog('🔍 Usando interceptação global do getUserMedia...', 'info');
      
      // Verificar estado da interceptação global
      addLog(`🔍 Estado da interceptação global: ${window.getUserMediaIntercepted ? 'ATIVA' : 'INATIVA'}`, 'info');
      addLog(`🔍 Stream global anterior: ${window.currentMP3Stream ? 'EXISTE' : 'NÃO EXISTE'}`, 'info');
      addLog(`🔍 CallInfo status atual: ${callInfo.status}`, 'info');
      addLog(`🔍 CallInfo whatsapp_instance: ${callInfo.whatsapp_instance}`, 'info');
      
      // Definir o stream atual para a interceptação global
      window.currentMP3Stream = audioStream;
      addLog('🎵 Stream do MP3 definido para interceptação global', 'success');
      addLog(`🎵 Stream definido - ID: ${audioTrack.id}`, 'info');
      addLog(`🎵 Stream definido - Label: ${audioTrack.label}`, 'info');
      
      // Registrar source no array de sources ativos
      addAudioSource(source);
      
      // Iniciar reprodução do áudio MP3 apenas se solicitado
      if (shouldStartImmediately) {
        try {
          source.start();
          setIsPlayingAudio(true);
          addLog('🎵 Reprodução do MP3 iniciada imediatamente', 'success');
        } catch (startError) {
          addLog(`Erro ao iniciar reprodução: ${startError.message}`, 'error');
          // Remover source do array se falhou ao iniciar
          removeAudioSource(source);
          return;
        }
      } else {
        addLog('🎵 Source criado, aguardando chamada ser aceita para iniciar...', 'info');
        // Armazenar o source para iniciar posteriormente
        window.pendingAudioSource = source;
      }
      
      // Aguardar um pouco para a interceptação ser aplicada
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      addLog('🎵 Microfone substituído pelo MP3 via interceptação!', 'success');
      toast.success('Áudio do MP3 transmitido como microfone!');
      
      // Parar quando terminar
      source.onended = () => {
        setIsPlayingAudio(false);
        addLog('✅ Substituição de microfone finalizada', 'info');
        
        // Remover source do array de sources ativos
        removeAudioSource(source);
        
        // Limpar stream global
        window.currentMP3Stream = null;
        addLog('🧹 Stream global limpo', 'info');
      };
      
    } catch (error) {
      addLog(`Erro na substituição de microfone: ${error.message}`, 'error');
      toast.error('Erro ao substituir microfone');
    }
  };

  // Função para forçar microfone a capturar áudio com configurações específicas
  const forceMicrophoneCapture = async (token) => {
    try {
      if (!wavoipInstances || !wavoipInstances[token]) {
        addLog('❌ Instância Wavoip não encontrada', 'error');
        return;
      }

      const wavoip = wavoipInstances[token].whatsapp_instance;
      
      if (!wavoip) {
        addLog('❌ Instância Wavoip inválida', 'error');
        return;
      }
      
      addLog('🎤 Forçando microfone a capturar áudio...', 'info');
      
      if (!uploadedFile) {
        addLog('❌ Nenhum arquivo carregado', 'error');
        return;
      }

      // Garantir que o microfone esteja desmutado
      try {
        if (typeof wavoip.unMute === 'function') {
          await wavoip.unMute();
          addLog('🔊 Microfone desmutado', 'success');
        } else {
          addLog('⚠️ Método unMute não disponível', 'warning');
        }
      } catch (muteError) {
        addLog(`Erro ao desmutar: ${muteError.message}`, 'warning');
      }

      // Criar elemento de áudio com configurações específicas para captura
      const audioElement = new Audio();
      const audioUrl = URL.createObjectURL(uploadedFile);
      
      audioElement.src = audioUrl;
      audioElement.volume = 1.0; // Volume máximo
      audioElement.loop = false;
      
      // Configurações específicas para melhor captura
      audioElement.preload = 'auto';
      audioElement.crossOrigin = 'anonymous';
      
      // Registrar elemento no controle
      addAudioElement(audioElement);
      
      // Eventos
      audioElement.onplay = () => {
        setIsPlayingAudio(true);
        addLog('🎵 Áudio iniciado para captura', 'success');
      };
      
      audioElement.onended = () => {
        setIsPlayingAudio(false);
        addLog('✅ Captura finalizada', 'info');
        removeAudioElement(audioElement);
        URL.revokeObjectURL(audioUrl);
      };
      
      audioElement.onerror = (error) => {
        addLog(`Erro no áudio: ${error.message}`, 'error');
        setIsPlayingAudio(false);
        removeAudioElement(audioElement);
      };
      
      // Aguardar microfone estar pronto
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Reproduzir áudio
      try {
        await audioElement.play();
        addLog('🎵 Áudio reproduzido para captura', 'success');
        
        // Tentar aumentar volume do sistema se possível
        try {
          // Tentar usar Web Audio API para aumentar volume
          if (audioContext) {
            const source = audioContext.createMediaElementSource(audioElement);
            const gainNode = audioContext.createGain();
            gainNode.gain.value = 3.0; // Volume muito alto
            
            source.connect(gainNode);
            gainNode.connect(audioContext.destination);
            
            addLog('🔊 Volume aumentado via Web Audio API', 'success');
          }
        } catch (webAudioError) {
          addLog(`Erro ao aumentar volume: ${webAudioError.message}`, 'warning');
        }
        
        toast.success('Áudio reproduzido! Microfone deve capturar.');
        
      } catch (playError) {
        addLog(`Erro ao reproduzir: ${playError.message}`, 'error');
        toast.error('Erro ao reproduzir áudio');
      }
      
    } catch (error) {
      addLog(`Erro na captura forçada: ${error.message}`, 'error');
      toast.error('Erro ao forçar captura');
    }
  };

  // Função de teste simples para verificar reprodução
  const testAudioPlayback = async () => {
    try {
      addLog('🧪 Testando reprodução de áudio...', 'info');
      
      if (!uploadedFile) {
        addLog('❌ Nenhum arquivo para teste', 'error');
        return;
      }

      // Informações do arquivo
      addLog(`🧪 Arquivo: ${uploadedFile.name} (${uploadedFile.size} bytes)`, 'info');
      addLog(`🧪 Tipo: ${uploadedFile.type}`, 'info');

      // Criar elemento de áudio simples
      const testAudio = new Audio();
      const audioUrl = URL.createObjectURL(uploadedFile);
      
      testAudio.src = audioUrl;
      testAudio.volume = 0.3; // Volume baixo para teste
      testAudio.preload = 'auto';
      
      // Registrar elemento no controle
      addAudioElement(testAudio);
      
      // Eventos de teste com mais detalhes
      testAudio.onloadstart = () => addLog('🧪 Carregamento iniciado', 'info');
      testAudio.onloadedmetadata = () => {
        addLog(`🧪 Duração: ${testAudio.duration.toFixed(2)}s`, 'info');
        addLog(`🧪 Sample Rate: ${testAudio.webkitAudioDecodedByteCount || 'N/A'}`, 'info');
      };
      testAudio.onloadeddata = () => addLog('🧪 Dados carregados', 'info');
      testAudio.oncanplay = () => addLog('🧪 Pode reproduzir', 'info');
      testAudio.onplay = () => {
        addLog('🧪 Reprodução iniciada - APENAS TESTE LOCAL', 'success');
        addLog('🧪 ⚠️ Se ouvir chiado, é do arquivo de áudio', 'warning');
        setIsPlayingAudio(true);
      };
      testAudio.onended = () => {
        addLog('🧪 Teste de reprodução finalizado', 'success');
        setIsPlayingAudio(false);
        removeAudioElement(testAudio);
        URL.revokeObjectURL(audioUrl);
      };
      testAudio.onerror = (error) => {
        addLog(`🧪 Erro: ${error.message}`, 'error');
        removeAudioElement(testAudio);
        URL.revokeObjectURL(audioUrl);
      };
      
      // Tentar reproduzir
      try {
        await testAudio.play();
        addLog('🧪 Teste de reprodução bem-sucedido', 'success');
        addLog('🧪 💡 Este é apenas um teste LOCAL - não vai para o dispositivo', 'info');
        toast.success('Teste de áudio funcionou!');
      } catch (playError) {
        addLog(`🧪 Erro no teste: ${playError.message}`, 'error');
        addLog(`🧪 Código do erro: ${playError.code}`, 'error');
        toast.error('Teste de áudio falhou');
        URL.revokeObjectURL(audioUrl);
      }
      
    } catch (error) {
      addLog(`🧪 Erro no teste: ${error.message}`, 'error');
    }
  };

  // Função de fallback para recriar AudioContext se necessário
  const recreateAudioContext = async () => {
    try {
      addLog('🔄 Tentando recriar AudioContext...', 'info');
      
      // Suspender contexto atual se existir
      if (audioContext) {
        await audioContext.suspend();
        addLog('⏸️ AudioContext suspenso', 'info');
      }
      
      // Criar novo AudioContext
      const newAudioContext = new (window.AudioContext || window.webkitAudioContext)();
      setAudioContext(newAudioContext);
      
      addLog(`✅ Novo AudioContext criado: ${newAudioContext.state}`, 'success');
      
      // Se estava suspenso, retomar
      if (newAudioContext.state === 'suspended') {
        await newAudioContext.resume();
        addLog('▶️ AudioContext retomado', 'success');
      }
      
      return newAudioContext;
    } catch (error) {
      addLog(`Erro ao recriar AudioContext: ${error.message}`, 'error');
      return null;
    }
  };

  // Função para reproduzir áudio com elemento HTML otimizado para captura
  const playAudioWithHTMLOptimized = async (token) => {
    try {
      if (!wavoipInstances || !wavoipInstances[token]) {
        addLog('❌ Instância Wavoip não encontrada', 'error');
        return;
      }

      const wavoip = wavoipInstances[token].whatsapp_instance;
      
      if (!wavoip) {
        addLog('❌ Instância Wavoip inválida', 'error');
        return;
      }
      
      addLog('🎵 Reprodução HTML otimizada para captura...', 'info');
      
      // Debug: verificar arquivo
      addLog(`🔍 UploadedFile: ${uploadedFile ? 'disponível' : 'não disponível'}`, 'info');
      
      if (uploadedFile) {
        addLog(`🔍 File name: ${uploadedFile.name}`, 'info');
        addLog(`🔍 File size: ${uploadedFile.size} bytes`, 'info');
        addLog(`🔍 File type: ${uploadedFile.type}`, 'info');
      }
      
      if (!uploadedFile) {
        addLog('❌ Nenhum arquivo carregado', 'error');
        return;
      }

      // Criar elemento de áudio
      const audioElement = new Audio();
      const audioUrl = URL.createObjectURL(uploadedFile);
      
      audioElement.src = audioUrl;
      audioElement.volume = 1.0; // Volume máximo
      audioElement.loop = false;
      
      // Configurações para melhor captura
      audioElement.preload = 'auto';
      audioElement.crossOrigin = 'anonymous';
      
      // Registrar elemento no controle
      addAudioElement(audioElement);
      
      // Eventos
      audioElement.onplay = () => {
        setIsPlayingAudio(true);
        addLog('🎵 Áudio HTML iniciado', 'success');
      };
      
      audioElement.onended = () => {
        setIsPlayingAudio(false);
        addLog('✅ Áudio HTML finalizado', 'info');
        removeAudioElement(audioElement);
        URL.revokeObjectURL(audioUrl);
      };
      
      audioElement.onerror = (error) => {
        addLog(`Erro no áudio HTML: ${error.message}`, 'error');
        setIsPlayingAudio(false);
        removeAudioElement(audioElement);
      };
      
      // Garantir que o microfone esteja desmutado
      try {
        if (typeof wavoip.unMute === 'function') {
          await wavoip.unMute();
          addLog('🔊 Microfone desmutado', 'success');
        } else {
          addLog('⚠️ Método unMute não disponível', 'warning');
        }
      } catch (muteError) {
        addLog(`Erro ao desmutar: ${muteError.message}`, 'warning');
      }
      
      // Aguardar um pouco
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Reproduzir áudio
      try {
        addLog('🔄 Tentando reproduzir elemento HTML...', 'info');
        await audioElement.play();
        addLog('🎵 Áudio HTML reproduzido com sucesso', 'success');
        toast.success('Áudio HTML reproduzido!');
        
        // Tentar aumentar volume após iniciar
        setTimeout(() => {
          audioElement.volume = 1.0;
          addLog('🔊 Volume HTML definido para máximo', 'info');
        }, 100);
        
      } catch (playError) {
        addLog(`Erro ao reproduzir: ${playError.message}`, 'error');
        addLog(`Erro detalhado: ${playError.name} - ${playError.code}`, 'error');
        toast.error('Erro ao reproduzir áudio');
      }
      
    } catch (error) {
      addLog(`Erro na reprodução HTML: ${error.message}`, 'error');
      toast.error('Erro ao reproduzir áudio');
    }
  };

  // Função simples para reproduzir áudio e desmutar microfone
  const playAudioSimple = async (token) => {
    try {
      if (!wavoipInstances || !wavoipInstances[token]) {
        addLog('❌ Instância Wavoip não encontrada', 'error');
        return;
      }

      const wavoip = wavoipInstances[token].whatsapp_instance;
      
      if (!wavoip) {
        addLog('❌ Instância Wavoip inválida', 'error');
        return;
      }
      
      addLog('🎵 Reprodução simples de áudio...', 'info');
      
      // Debug: verificar estado do áudio
      addLog(`🔍 AudioContext: ${audioContext ? 'disponível' : 'não disponível'}`, 'info');
      addLog(`🔍 AudioBuffer: ${audioBuffer ? 'disponível' : 'não disponível'}`, 'info');
      
      if (audioContext) {
        addLog(`🔍 AudioContext state: ${audioContext.state}`, 'info');
      }
      
      if (audioBuffer) {
        addLog(`🔍 AudioBuffer duration: ${audioBuffer.duration}s`, 'info');
        addLog(`🔍 AudioBuffer sampleRate: ${audioBuffer.sampleRate}Hz`, 'info');
        addLog(`🔍 AudioBuffer channels: ${audioBuffer.numberOfChannels}`, 'info');
      }
      
      if (!audioContext || !audioBuffer) {
        addLog('❌ AudioContext ou AudioBuffer não disponível', 'error');
        
        // Tentar recriar AudioContext se não existir
        if (!audioContext) {
          const newContext = await recreateAudioContext();
          if (!newContext) {
            addLog('❌ Não foi possível criar AudioContext', 'error');
            return;
          }
        }
        
        // Se ainda não tem audioBuffer, tentar recarregar arquivo
        if (!audioBuffer && uploadedFile) {
          addLog('🔄 Tentando recarregar arquivo de áudio...', 'info');
          try {
            const arrayBuffer = await uploadedFile.arrayBuffer();
            const newAudioBuffer = await audioContext.decodeAudioData(arrayBuffer);
            setAudioBuffer(newAudioBuffer);
            addLog('✅ AudioBuffer recarregado', 'success');
          } catch (reloadError) {
            addLog(`Erro ao recarregar áudio: ${reloadError.message}`, 'error');
            return;
          }
        }
        
        if (!audioBuffer) {
          addLog('❌ Não foi possível carregar áudio', 'error');
          return;
        }
      }

      // Criar source de áudio
      const source = audioContext.createBufferSource();
      source.buffer = audioBuffer;
      source.loop = false;

      // Criar gain node com volume alto
      const gainNode = audioContext.createGain();
      gainNode.gain.value = 2.5; // Volume alto para garantir captura

      // Conectar source -> gain -> destination (alto-falantes)
      source.connect(gainNode);
      gainNode.connect(audioContext.destination);

      // Garantir que o microfone esteja desmutado
      try {
        if (typeof wavoip.unMute === 'function') {
          await wavoip.unMute();
          addLog('🔊 Microfone desmutado', 'success');
        } else {
          addLog('⚠️ Método unMute não disponível', 'warning');
        }
      } catch (muteError) {
        addLog(`Erro ao desmutar: ${muteError.message}`, 'warning');
      }

      // Aguardar um pouco para garantir que o microfone esteja pronto
      await new Promise(resolve => setTimeout(resolve, 300));

      // Registrar source no array de sources ativos
      addAudioSource(source);
      
      // Iniciar reprodução do áudio
      try {
        source.start();
        setIsPlayingAudio(true);
        
        addLog('🎵 Áudio reproduzido pelos alto-falantes com volume alto', 'success');
        toast.success('Áudio reproduzido! Microfone deve capturar.');
        
        // Tentar aumentar ainda mais o volume após iniciar
        setTimeout(() => {
          gainNode.gain.value = 4.0; // Volume muito alto
          addLog('🔊 Volume aumentado para 4.0x', 'info');
        }, 100);
      } catch (startError) {
        addLog(`Erro ao iniciar reprodução: ${startError.message}`, 'error');
        // Remover source do array se falhou ao iniciar
        removeAudioSource(source);
        toast.error('Erro ao iniciar reprodução');
      }
      
      // Parar quando terminar
      source.onended = () => {
        setIsPlayingAudio(false);
        addLog('✅ Reprodução simples finalizada', 'info');
        
        // Remover source do array de sources ativos
        removeAudioSource(source);
      };
      
    } catch (error) {
      addLog(`Erro na reprodução simples: ${error.message}`, 'error');
      toast.error('Erro ao reproduzir áudio');
    }
  };

  // Função para reproduzir áudio através do microfone (nova abordagem)
  const playAudioThroughMicrophone = async (token) => {
    if (!audioContext || !audioBuffer) {
      addLog('Nenhum arquivo de áudio carregado para reprodução', 'warning');
      return;
    }

    if (!token) {
      addLog('Token não fornecido para reprodução de áudio', 'error');
      return;
    }

    if (!wavoipInstances[token]) {
      addLog(`❌ Instância Wavoip não encontrada para token: ${token.substring(0, 8)}...`, 'error');
      addLog(`📋 Tokens disponíveis: ${Object.keys(wavoipInstances).map(t => t.substring(0, 8) + '...').join(', ')}`, 'info');
      addLog(`🔍 Estado atual das instâncias: ${JSON.stringify(Object.keys(wavoipInstances))}`, 'info');
      return;
    }

    try {
      const wavoip = wavoipInstances[token].whatsapp_instance;
      
      // Primeiro, mutar o microfone real
      await wavoip.mute();
      addLog('🔇 Microfone mutado', 'info');
      
      // Aguardar um pouco para garantir que o mute foi aplicado
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Criar um MediaStream com o áudio do arquivo
      const source = audioContext.createBufferSource();
      source.buffer = audioBuffer;
      
      // Criar um MediaStreamDestination para capturar o áudio
      const destination = audioContext.createMediaStreamDestination();
      source.connect(destination);
      
      // Tentar substituir o stream de áudio da chamada
      try {
        // Método 1: Tentar usar getUserMedia para criar um stream virtual
        const virtualStream = new MediaStream();
        const audioTrack = destination.stream.getAudioTracks()[0];
        virtualStream.addTrack(audioTrack);
        
        // Tentar diferentes métodos para substituir o stream
        if (wavoip.replaceStream) {
          await wavoip.replaceStream(virtualStream);
          addLog('🎵 Stream de áudio substituído via replaceStream', 'success');
        } else if (wavoip.setLocalStream) {
          await wavoip.setLocalStream(virtualStream);
          addLog('🎵 Stream de áudio substituído via setLocalStream', 'success');
        } else {
          // Fallback: tentar usar o peerConnection diretamente
          if (wavoip.peerConnection) {
            const sender = wavoip.peerConnection.getSenders().find(s => 
              s.track && s.track.kind === 'audio'
            );
            if (sender) {
              await sender.replaceTrack(audioTrack);
              addLog('🎵 Track de áudio substituído via peerConnection', 'success');
            } else {
              throw new Error('Sender de áudio não encontrado no peerConnection');
            }
          } else {
            throw new Error('peerConnection não disponível');
          }
        }
        
        // Desmutar após substituir o stream
        await wavoip.unMute();
        addLog('🔊 Microfone desmutado com áudio do arquivo', 'success');
        
      } catch (streamError) {
        addLog(`Erro ao substituir stream: ${streamError.message}`, 'error');
        
        // Fallback: apenas desmutar e reproduzir localmente
        await wavoip.unMute();
        source.connect(audioContext.destination);
        addLog('⚠️ Reproduzindo apenas localmente (stream não substituído)', 'warning');
      }
      
      // Registrar source no array de sources ativos
      addAudioSource(source);
      
      source.start();
      
      setIsPlayingAudio(true);
      addLog('🎵 Áudio sendo transmitido através do microfone...', 'success');
      toast.success('Áudio transmitido através do microfone!');
      
      source.onended = () => {
        setIsPlayingAudio(false);
        addLog('✅ Transmissão de áudio finalizada', 'info');
        
        // Remover source do array de sources ativos
        removeAudioSource(source);
      };
      
    } catch (error) {
      addLog(`Erro ao reproduzir áudio através do microfone: ${error.message}`, 'error');
      toast.error('Erro ao transmitir áudio');
    }
  };

  // Função para reproduzir áudio na chamada via Wavoip
  const playAudioToCall = () => {
    try {
      const wavoip = wavoipInstances[callInfo.whatsapp_instance].whatsapp_instance;
      
      // Criar source de áudio
      const source = audioContext.createBufferSource();
      source.buffer = audioBuffer;
      
      // Criar um MediaStreamDestination para capturar o áudio
      const destination = audioContext.createMediaStreamDestination();
      source.connect(destination);
      
      // Debug: mostrar métodos disponíveis na instância Wavoip
      addLog(`🔍 Métodos disponíveis na instância Wavoip: ${Object.getOwnPropertyNames(wavoip).join(', ')}`, 'info');
      
      // Tentar diferentes métodos para injetar áudio na chamada
      try {
        // Método 1: Tentar usar replaceTrack se disponível
        if (wavoip.replaceAudioTrack) {
          wavoip.replaceAudioTrack(destination.stream.getAudioTracks()[0]);
          addLog('🎵 Áudio injetado via replaceAudioTrack', 'success');
        }
        // Método 2: Tentar usar setAudioSource
        else if (wavoip.setAudioSource) {
          wavoip.setAudioSource(destination.stream);
          addLog('🎵 Áudio injetado via setAudioSource', 'success');
        }
        // Método 3: Tentar usar injectAudio
        else if (wavoip.injectAudio) {
          wavoip.injectAudio(source);
          addLog('🎵 Áudio injetado via injectAudio', 'success');
        }
        // Método 4: Tentar usar o peerConnection diretamente
        else if (wavoip.peerConnection) {
          const audioTrack = destination.stream.getAudioTracks()[0];
          const sender = wavoip.peerConnection.getSenders().find(s => 
            s.track && s.track.kind === 'audio'
          );
          if (sender) {
            sender.replaceTrack(audioTrack);
            addLog('🎵 Áudio injetado via peerConnection.replaceTrack', 'success');
          } else {
            throw new Error('Sender de áudio não encontrado');
          }
        }
        // Método 5: Tentar usar getUserMedia para criar um stream virtual
        else {
          try {
            // Criar um stream virtual com o áudio
            const virtualStream = new MediaStream();
            const audioTrack = destination.stream.getAudioTracks()[0];
            virtualStream.addTrack(audioTrack);
            
            // Tentar substituir o stream de entrada
            if (wavoip.replaceStream) {
              wavoip.replaceStream(virtualStream);
              addLog('🎵 Áudio injetado via replaceStream', 'success');
            } else if (wavoip.setLocalStream) {
              wavoip.setLocalStream(virtualStream);
              addLog('🎵 Áudio injetado via setLocalStream', 'success');
            } else {
              throw new Error('Nenhum método de injeção encontrado');
            }
          } catch (streamError) {
            throw streamError;
          }
        }
      } catch (injectionError) {
        addLog(`Erro ao injetar áudio: ${injectionError.message}`, 'error');
        // Fallback: reproduzir localmente
        source.connect(audioContext.destination);
        addLog('⚠️ Reproduzindo apenas localmente devido ao erro', 'warning');
      }
      
      // Registrar source no array de sources ativos
      addAudioSource(source);
      
      source.start();
      
      setIsPlayingAudio(true);
      addLog('🎵 Enviando arquivo de áudio para a chamada...', 'success');
      toast.success('Áudio sendo transmitido na chamada!');
      
      source.onended = () => {
        setIsPlayingAudio(false);
        addLog('✅ Transmissão de áudio finalizada', 'info');
        
        // Remover source do array de sources ativos
        removeAudioSource(source);
      };
      
    } catch (error) {
      addLog(`Erro ao transmitir áudio na chamada: ${error.message}`, 'error');
      toast.error('Erro ao transmitir áudio');
    }
  };

  // Função para aceitar chamada (baseada no exemplo Vue)
  const acceptCall = async () => {
    try {
      const wavoip_token = callInfo.whatsapp_instance;
      
      if (!wavoip_token || !wavoipInstances || !wavoipInstances[wavoip_token]) {
        addLog('Token inválido ou instância não encontrada ao aceitar chamada', 'error');
        return;
      }

      const wavoip = wavoipInstances[wavoip_token].whatsapp_instance;
      
      if (!wavoip || typeof wavoip.acceptCall !== 'function') {
        addLog('Instância Wavoip inválida ou método acceptCall não disponível', 'error');
        return;
      }
      
      await wavoip.acceptCall();
      
      setCallInfo(prev => ({ 
        ...prev, 
        status: 'accept',
        active_start_date: new Date()
      }));
      
      addLog('Chamada aceita', 'success');
      toast.success('Chamada aceita!');
      
      // O useEffect vai detectar a mudança e reproduzir o áudio automaticamente
      
    } catch (error) {
      addLog(`Erro ao aceitar chamada: ${error.message}`, 'error');
      toast.error('Erro ao aceitar chamada');
    }
  };

  // Função para rejeitar chamada (baseada no exemplo Vue)
  const rejectCall = async () => {
    try {
      const wavoip_token = callInfo.whatsapp_instance;
      
      if (!wavoip_token || !wavoipInstances || !wavoipInstances[wavoip_token]) {
        addLog('Token inválido ou instância não encontrada ao rejeitar chamada', 'error');
        return;
      }

      const wavoip = wavoipInstances[wavoip_token].whatsapp_instance;
      
      if (!wavoip || typeof wavoip.rejectCall !== 'function') {
        addLog('Instância Wavoip inválida ou método rejectCall não disponível', 'error');
        return;
      }
      
      await wavoip.rejectCall();
      
      setCallInfo({
        id: null,
        duration: 0,
        tag: null,
        phone: null,
        picture_profile: null,
        status: null,
        direction: null,
        whatsapp_instance: null,
        active_start_date: null,
        inbox_name: null,
        chat_id: null,
      });
      
      stopAllAudio(); // Parar áudio quando chamada for rejeitada
      addLog('Chamada rejeitada', 'info');
      
    } catch (error) {
      addLog(`Erro ao rejeitar chamada: ${error.message}`, 'error');
    }
  };

  // Função para finalizar chamada (baseada no exemplo Vue)
  const endCall = async () => {
    try {
      const wavoip_token = callInfo.whatsapp_instance;
      
      if (!wavoip_token || !wavoipInstances || !wavoipInstances[wavoip_token]) {
        addLog('Token inválido ou instância não encontrada ao finalizar chamada', 'error');
        return;
      }

      const wavoip = wavoipInstances[wavoip_token].whatsapp_instance;
      
      if (!wavoip || typeof wavoip.endCall !== 'function') {
        addLog('Instância Wavoip inválida ou método endCall não disponível', 'error');
        return;
      }
      
      await wavoip.endCall();
      
      setCallInfo({
        id: null,
        duration: 0,
        tag: null,
        phone: null,
        picture_profile: null,
        status: null,
        direction: null,
        whatsapp_instance: null,
        active_start_date: null,
        inbox_name: null,
        chat_id: null,
      });
      
      stopAllAudio(); // Parar áudio quando chamada for finalizada
      addLog('Chamada finalizada pelo usuário', 'info');
      toast.success('Chamada finalizada');
      
    } catch (error) {
      addLog(`Erro ao finalizar chamada: ${error.message}`, 'error');
    }
  };

  // Função para parar todos os áudios
  const stopAllAudio = () => {
    setIsPlayingAudio(false);
    addLog('🔇 Parando todos os áudios', 'info');
    
    // Parar todos os AudioBufferSourceNode ativos
    activeAudioSources.current.forEach((source, index) => {
      try {
        if (source && typeof source.stop === 'function') {
          source.stop();
          addLog(`🔇 Source ${index + 1} parado`, 'info');
        }
      } catch (error) {
        addLog(`⚠️ Erro ao parar source ${index + 1}: ${error.message}`, 'warning');
      }
    });
    
    // Limpar array de sources ativos
    activeAudioSources.current = [];
    
    // DEBUG: Verificar elementos HTML antes de parar
    addLog(`🔍 DEBUG: activeAudioElements.current.length = ${activeAudioElements.current.length}`, 'info');
    
    // Parar todos os elementos de áudio HTML rastreados
    activeAudioElements.current.forEach((element, index) => {
      try {
        addLog(`🔍 DEBUG: Processando elemento HTML ${index + 1}`, 'info');
        addLog(`🔍 DEBUG: Elemento existe: ${!!element}`, 'info');
        addLog(`🔍 DEBUG: Tem método pause: ${typeof element.pause === 'function'}`, 'info');
        addLog(`🔍 DEBUG: Estado do elemento: ${element.paused ? 'pausado' : 'tocando'}`, 'info');
        
        if (element && typeof element.pause === 'function') {
          element.pause();
          element.currentTime = 0;
          addLog(`🔇 Elemento HTML ${index + 1} pausado`, 'info');
        } else {
          addLog(`⚠️ Elemento HTML ${index + 1} inválido ou sem método pause`, 'warning');
        }
      } catch (error) {
        addLog(`⚠️ Erro ao pausar elemento HTML ${index + 1}: ${error.message}`, 'warning');
      }
    });
    
    // Limpar array de elementos HTML ativos
    activeAudioElements.current = [];
    
    // Parar todos os elementos de áudio ativos no DOM (fallback)
    const audioElements = document.querySelectorAll('audio');
    addLog(`🔍 DEBUG: Encontrados ${audioElements.length} elementos de áudio no DOM`, 'info');
    
    audioElements.forEach((audio, index) => {
      try {
        addLog(`🔍 DEBUG: Processando elemento DOM ${index + 1} - pausado: ${audio.paused}, duração: ${audio.duration}s`, 'info');
        audio.pause();
        audio.currentTime = 0;
        addLog(`🔇 Elemento DOM ${index + 1} pausado (fallback)`, 'info');
      } catch (error) {
        addLog(`⚠️ Erro ao pausar elemento DOM ${index + 1}: ${error.message}`, 'warning');
      }
    });
    
    // Limpar stream global
    if (window.currentMP3Stream) {
      window.currentMP3Stream.getTracks().forEach(track => track.stop());
      window.currentMP3Stream = null;
      addLog('🧹 Stream global limpo', 'info');
    }
    
    // Suspender AudioContext se existir
    if (audioContext && audioContext.state !== 'closed') {
      audioContext.suspend().catch(err => {
        addLog(`Erro ao suspender AudioContext: ${err.message}`, 'warning');
      });
    }
    
    // Forçar parada de todos os áudios de forma mais agressiva
    addLog('🔍 DEBUG: Iniciando parada agressiva de áudios...', 'info');
    
    // Tentar parar todos os elementos de áudio possíveis
    const allAudioElements = document.querySelectorAll('audio, video');
    allAudioElements.forEach((element, index) => {
      try {
        if (!element.paused) {
          element.pause();
          element.currentTime = 0;
          addLog(`🔇 Elemento mídia ${index + 1} forçado a parar`, 'info');
        }
      } catch (error) {
        addLog(`⚠️ Erro ao forçar parada do elemento ${index + 1}: ${error.message}`, 'warning');
      }
    });
    
    // Tentar parar todos os MediaStreams ativos
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      try {
        // Esta é uma abordagem mais agressiva - pode não funcionar em todos os navegadores
        const streams = document.querySelectorAll('audio, video');
        streams.forEach(element => {
          if (element.srcObject && element.srcObject.getTracks) {
            element.srcObject.getTracks().forEach(track => {
              track.stop();
              addLog(`🔇 Track ${track.kind} parado`, 'info');
            });
          }
        });
      } catch (error) {
        addLog(`⚠️ Erro ao parar tracks: ${error.message}`, 'warning');
      }
    }
    
    addLog('✅ Todos os áudios parados', 'success');
  };

  // Função para limpar instância Wavoip
  const cleanupWavoipInstance = (token) => {
    try {
      if (wavoipInstances && wavoipInstances[token] && wavoipInstances[token].whatsapp_instance) {
        const instance = wavoipInstances[token].whatsapp_instance;
        
        // Limpar event listeners do socket se existir
        if (instance && instance.socket) {
          safeSocketCall(instance.socket, 'removeAllListeners');
          addLog(`Event listeners removidos para token ${token.substring(0, 8)}...`, 'info');
        }
        
        // Tentar desconectar se o método existir
        if (instance && typeof instance.disconnect === 'function') {
          try {
            instance.disconnect();
            addLog(`Instância desconectada para token ${token.substring(0, 8)}...`, 'info');
          } catch (disconnectError) {
            addLog(`Erro ao desconectar: ${disconnectError.message}`, 'warning');
          }
        }
      }
    } catch (error) {
      addLog(`Erro na limpeza da instância: ${error.message}`, 'error');
    }
  };

  // Função para criar stream de áudio robusto
  const createRobustAudioStream = async (audioBuffer) => {
    try {
      addLog('🔧 Criando stream de áudio robusto...', 'info');
      
      // Garantir que o AudioContext esteja ativo
      if (audioContext.state === 'suspended') {
        await audioContext.resume();
        addLog(`✅ AudioContext retomado: ${audioContext.state}`, 'success');
      }
      
      // Criar source de áudio
      const source = audioContext.createBufferSource();
      source.buffer = audioBuffer;
      source.loop = false;
      
      // Criar gain node para controle de volume
      const gainNode = audioContext.createGain();
      gainNode.gain.value = 1.0;
      
      // Criar compressor para melhor qualidade
      const compressor = audioContext.createDynamicsCompressor();
      compressor.threshold.value = -24;
      compressor.knee.value = 30;
      compressor.ratio.value = 12;
      compressor.attack.value = 0.003;
      compressor.release.value = 0.25;
      
      // Criar MediaStreamDestination
      const destination = audioContext.createMediaStreamDestination();
      
      // Conectar: source -> gain -> compressor -> destination
      source.connect(gainNode);
      gainNode.connect(compressor);
      compressor.connect(destination);
      
      const audioStream = destination.stream;
      const audioTrack = audioStream.getAudioTracks()[0];
      
      addLog('🔧 Stream robusto criado com compressor', 'success');
      addLog(`🔧 Track ID: ${audioTrack.id}`, 'info');
      addLog(`🔧 Track settings: ${JSON.stringify(audioTrack.getSettings())}`, 'info');
      
      return { source, audioStream, audioTrack, gainNode };
      
    } catch (error) {
      addLog(`Erro ao criar stream robusto: ${error.message}`, 'error');
      throw error;
    }
  };

  // Função para debug da biblioteca Wavoip
  const debugWavoipMethods = (token) => {
    try {
      if (!wavoipInstances[token]) {
        addLog('❌ Instância não encontrada para debug', 'error');
        return;
      }

      const wavoip = wavoipInstances[token].whatsapp_instance;
      
      addLog('🔍 === DEBUG BIBLIOTECA WAVOIP ===', 'info');
      addLog(`🔍 Token: ${token.substring(0, 8)}...`, 'info');
      
      // Verificar propriedades principais
      addLog(`🔍 peerConnection: ${wavoip.peerConnection ? 'disponível' : 'não disponível'}`, 'info');
      addLog(`🔍 socket: ${wavoip.socket ? 'disponível' : 'não disponível'}`, 'info');
      
      if (wavoip.peerConnection) {
        addLog(`🔍 PeerConnection state: ${wavoip.peerConnection.connectionState}`, 'info');
        addLog(`🔍 Senders: ${wavoip.peerConnection.getSenders().length}`, 'info');
        addLog(`🔍 Receivers: ${wavoip.peerConnection.getReceivers().length}`, 'info');
      }
      
      // Listar todos os métodos disponíveis
      const methods = Object.getOwnPropertyNames(wavoip);
      addLog(`🔍 Métodos disponíveis (${methods.length}):`, 'info');
      methods.forEach(method => {
        if (typeof wavoip[method] === 'function') {
          addLog(`  - ${method}()`, 'info');
        } else {
          addLog(`  - ${method}: ${typeof wavoip[method]}`, 'info');
        }
      });
      
      // Verificar métodos específicos para áudio
      const audioMethods = ['replaceAudioTrack', 'setLocalStream', 'replaceStream', 'injectAudio', 'setAudioSource'];
      addLog('🔍 Métodos de áudio específicos:', 'info');
      audioMethods.forEach(method => {
        const exists = typeof wavoip[method] === 'function';
        addLog(`  - ${method}: ${exists ? '✅ disponível' : '❌ não disponível'}`, exists ? 'success' : 'warning');
      });
      
      addLog('🔍 === FIM DEBUG ===', 'info');
      
    } catch (error) {
      addLog(`🔍 Erro no debug: ${error.message}`, 'error');
    }
  };

  // Função para testar interceptação global
  const testGlobalInterception = async () => {
    try {
      addLog('🧪 Testando interceptação global do getUserMedia...', 'info');
      
      if (!audioContext || !audioBuffer) {
        addLog('❌ AudioContext ou AudioBuffer não disponível', 'error');
        return;
      }

      // Criar stream de teste
      const { source, audioStream } = await createRobustAudioStream(audioBuffer);
      
      // Definir stream global
      window.currentMP3Stream = audioStream;
      addLog('🎵 Stream de teste definido globalmente', 'success');
      
      // Testar getUserMedia
      try {
        addLog('🧪 Testando getUserMedia com interceptação...', 'info');
        const testStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        
        if (testStream === audioStream) {
          addLog('🧪 ✅ Interceptação funcionando! Stream do MP3 retornado', 'success');
        } else {
          addLog('🧪 ❌ Interceptação não funcionou - stream original retornado', 'warning');
        }
        
        // Parar stream de teste
        testStream.getTracks().forEach(track => track.stop());
        
      } catch (error) {
        addLog(`🧪 ❌ Erro no teste: ${error.message}`, 'error');
      }
      
      // Limpar stream global
      window.currentMP3Stream = null;
      addLog('🧹 Stream de teste limpo', 'info');
      
    } catch (error) {
      addLog(`🧪 Erro no teste de interceptação: ${error.message}`, 'error');
    }
  };

  // Função para usar MediaStreamTrackProcessor (API moderna)
  const replaceStreamWithMediaProcessor = async (token) => {
    try {
      addLog('🔧 Substituindo stream usando MediaStreamTrackProcessor...', 'info');
      
      if (!wavoipInstances[token]) {
        addLog('❌ Instância não encontrada', 'error');
        return;
      }

      const wavoip = wavoipInstances[token].whatsapp_instance;
      
      // Verificar se há stream do MP3 ativo
      if (!window.currentMP3Stream) {
        addLog('❌ Nenhum stream do MP3 ativo', 'error');
        return;
      }

      // Verificar se MediaStreamTrackProcessor está disponível
      if (!window.MediaStreamTrackProcessor) {
        addLog('❌ MediaStreamTrackProcessor não disponível neste navegador', 'error');
        return;
      }

      addLog('✅ MediaStreamTrackProcessor disponível', 'success');

      // Obter track de áudio do MP3
      const mp3AudioTrack = window.currentMP3Stream.getAudioTracks()[0];
      
      if (!mp3AudioTrack) {
        addLog('❌ Nenhuma track de áudio do MP3 encontrada', 'error');
        return;
      }

      addLog(`🎵 Track do MP3: ${mp3AudioTrack.id}`, 'info');

      // Criar processor para a track do MP3
      const processor = new MediaStreamTrackProcessor({ track: mp3AudioTrack });
      const readable = processor.readable;

      addLog('🔧 Processor criado com sucesso', 'success');

      // Tentar substituir o stream global
      try {
        // Criar um novo MediaStream com a track do MP3
        const newStream = new MediaStream([mp3AudioTrack]);
        
        // Atualizar o stream global
        window.currentMP3Stream = newStream;
        
        addLog('🎵 Stream global atualizado', 'success');
        
        // Forçar reconexão
        await wavoip.mute();
        await new Promise(resolve => setTimeout(resolve, 500));
        await wavoip.unMute();
        
        addLog('✅ Stream substituído via MediaStreamTrackProcessor!', 'success');
        toast.success('Stream substituído via MediaStreamTrackProcessor!');
        
      } catch (error) {
        addLog(`Erro ao substituir stream: ${error.message}`, 'error');
      }
      
    } catch (error) {
      addLog(`Erro na substituição via MediaProcessor: ${error.message}`, 'error');
      toast.error('Erro ao substituir stream via MediaProcessor');
    }
  };

  // Função para substituir stream usando WebRTC diretamente
  const replaceStreamWithWebRTC = async (token) => {
    try {
      addLog('🔧 Substituindo stream usando WebRTC diretamente...', 'info');
      
      if (!wavoipInstances[token]) {
        addLog('❌ Instância não encontrada', 'error');
        return;
      }

      const wavoip = wavoipInstances[token].whatsapp_instance;
      
      // Verificar se há stream do MP3 ativo
      if (!window.currentMP3Stream) {
        addLog('❌ Nenhum stream do MP3 ativo', 'error');
        return;
      }

      // Tentar acessar o PeerConnection através de diferentes caminhos
      let peerConnection = null;
      
      // Caminho 1: Direto da instância
      if (wavoip.peerConnection) {
        peerConnection = wavoip.peerConnection;
        addLog('🔍 PeerConnection encontrado via wavoip.peerConnection', 'success');
      }
      
      // Caminho 2: Através do socket
      if (!peerConnection && wavoip.socket && wavoip.socket.peerConnection) {
        peerConnection = wavoip.socket.peerConnection;
        addLog('🔍 PeerConnection encontrado via wavoip.socket.peerConnection', 'success');
      }
      
      // Caminho 3: Procurar em propriedades aninhadas
      if (!peerConnection) {
        const searchInObject = (obj, depth = 0) => {
          if (depth > 3) return null;
          if (obj && typeof obj === 'object') {
            if (obj.connectionState || obj.getSenders) return obj;
            for (const key in obj) {
              const result = searchInObject(obj[key], depth + 1);
              if (result) return result;
            }
          }
          return null;
        };
        
        peerConnection = searchInObject(wavoip);
        if (peerConnection) {
          addLog('🔍 PeerConnection encontrado via busca recursiva', 'success');
        }
      }
      
      if (!peerConnection) {
        addLog('❌ PeerConnection não encontrado', 'error');
        addLog('🔍 Tentando interceptar getUserMedia globalmente...', 'info');
        
        // Fallback: Usar interceptação global
        await forceAudioReconnection(token);
        return;
      }

      addLog(`🔍 PeerConnection state: ${peerConnection.connectionState}`, 'info');
      
      // Obter senders de áudio
      const senders = peerConnection.getSenders();
      addLog(`🔍 Encontrados ${senders.length} senders`, 'info');
      
      const audioSenders = senders.filter(sender => 
        sender.track && sender.track.kind === 'audio'
      );
      
      addLog(`🔍 Encontrados ${audioSenders.length} senders de áudio`, 'info');
      
      if (audioSenders.length === 0) {
        addLog('❌ Nenhum sender de áudio encontrado', 'error');
        return;
      }
      
      // Obter track de áudio do MP3
      const mp3AudioTrack = window.currentMP3Stream.getAudioTracks()[0];
      
      if (!mp3AudioTrack) {
        addLog('❌ Nenhuma track de áudio do MP3 encontrada', 'error');
        return;
      }
      
      addLog(`🎵 Track do MP3: ${mp3AudioTrack.id}`, 'info');
      
      // Substituir tracks de áudio
      let successCount = 0;
      
      for (const sender of audioSenders) {
        try {
          addLog(`🔄 Substituindo track do sender: ${sender.track.id}`, 'info');
          
          await sender.replaceTrack(mp3AudioTrack);
          successCount++;
          
          addLog(`✅ Track substituída com sucesso!`, 'success');
          
        } catch (error) {
          addLog(`❌ Erro ao substituir track: ${error.message}`, 'error');
          addLog(`❌ Código do erro: ${error.code}`, 'error');
        }
      }
      
      if (successCount > 0) {
        addLog(`🎉 ${successCount} track(s) substituída(s) com sucesso!`, 'success');
        toast.success('Stream de áudio substituído via WebRTC!');
      } else {
        addLog('❌ Nenhuma track foi substituída', 'error');
        toast.error('Falha ao substituir stream de áudio');
      }
      
    } catch (error) {
      addLog(`Erro na substituição via WebRTC: ${error.message}`, 'error');
      toast.error('Erro ao substituir stream via WebRTC');
    }
  };

  // Função para forçar reconexão de áudio durante chamada ativa
  const forceAudioReconnection = async (token) => {
    try {
      addLog('🔄 Forçando reconexão de áudio durante chamada...', 'info');
      
      if (!wavoipInstances[token]) {
        addLog('❌ Instância não encontrada', 'error');
        return;
      }

      const wavoip = wavoipInstances[token].whatsapp_instance;
      
      // Verificar se há stream do MP3 ativo
      if (!window.currentMP3Stream) {
        addLog('❌ Nenhum stream do MP3 ativo', 'error');
        return;
      }

      addLog('🎵 Stream do MP3 encontrado, forçando reconexão...', 'info');
      
      // Múltiplas tentativas de reconexão
      for (let i = 1; i <= 3; i++) {
        addLog(`🔄 Tentativa ${i}/3 de reconexão...`, 'info');
        
        try {
          await wavoip.mute();
          addLog(`🔇 Mute ${i} aplicado`, 'info');
          
          await new Promise(resolve => setTimeout(resolve, 1000));
          
          await wavoip.unMute();
          addLog(`🔊 Unmute ${i} aplicado`, 'info');
          
          // Aguardar um pouco para verificar se funcionou
          await new Promise(resolve => setTimeout(resolve, 2000));
          
        } catch (error) {
          addLog(`Erro na tentativa ${i}: ${error.message}`, 'warning');
        }
      }
      
      addLog('✅ Reconexão forçada concluída', 'success');
      toast.success('Reconexão de áudio forçada!');
      
    } catch (error) {
      addLog(`Erro na reconexão forçada: ${error.message}`, 'error');
    }
  };

  // Função para testar substituição de track
  const testTrackReplacement = async (token) => {
    try {
      addLog('🧪 Testando substituição de track...', 'info');
      
      if (!wavoipInstances[token]) {
        addLog('❌ Instância não encontrada', 'error');
        return;
      }

      const wavoip = wavoipInstances[token].whatsapp_instance;
      
      if (!wavoip.peerConnection) {
        addLog('❌ PeerConnection não disponível', 'error');
        return;
      }

      // Criar um stream de teste simples
      const { source, audioStream, audioTrack } = await createRobustAudioStream(audioBuffer);
      
      const senders = wavoip.peerConnection.getSenders();
      addLog(`🧪 Encontrados ${senders.length} senders`, 'info');
      
      for (const sender of senders) {
        if (sender.track && sender.track.kind === 'audio') {
          addLog(`🧪 Testando substituição do sender: ${sender.track.id}`, 'info');
          addLog(`🧪 Track original: ${sender.track.label}`, 'info');
          
          try {
            await sender.replaceTrack(audioTrack);
            addLog('🧪 ✅ Substituição bem-sucedida!', 'success');
            
            // Registrar source no array de sources ativos
            activeAudioSources.current.push(source);
            
            // Iniciar reprodução
            source.start();
            setIsPlayingAudio(true);
            
            // Parar após 5 segundos
            setTimeout(() => {
              source.stop();
              setIsPlayingAudio(false);
              addLog('🧪 Teste finalizado', 'info');
              
              // Remover source do array de sources ativos
              activeAudioSources.current = activeAudioSources.current.filter(s => s !== source);
            }, 5000);
            
            return;
          } catch (error) {
            addLog(`🧪 ❌ Erro na substituição: ${error.message}`, 'error');
            addLog(`🧪 Código do erro: ${error.code}`, 'error');
          }
        }
      }
      
      addLog('🧪 Nenhum sender de áudio encontrado', 'warning');
      
    } catch (error) {
      addLog(`🧪 Erro no teste: ${error.message}`, 'error');
    }
  };

  // Função para testar captura do microfone
  const testMicrophoneCapture = async () => {
    try {
      addLog('🎤 Testando captura do microfone...', 'info');
      
      // Solicitar acesso ao microfone
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        } 
      });
      
      addLog('🎤 Microfone acessado com sucesso', 'success');
      
      // Criar elemento de áudio para monitorar
      const audio = new Audio();
      audio.srcObject = stream;
      audio.volume = 0.1; // Volume baixo para monitoramento
      
      // Analisar o stream
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      const source = audioContext.createMediaStreamSource(stream);
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      
      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      let maxLevel = 0;
      let sampleCount = 0;
      
      const checkLevel = () => {
        analyser.getByteFrequencyData(dataArray);
        const level = Math.max(...dataArray);
        maxLevel = Math.max(maxLevel, level);
        sampleCount++;
        
        if (level > 10) { // Threshold para detectar áudio
          addLog(`🎤 Áudio detectado! Nível: ${level}/255`, 'success');
        }
        
        if (sampleCount < 50) { // Verificar por ~1 segundo
          setTimeout(checkLevel, 20);
        } else {
          addLog(`🎤 Teste finalizado. Nível máximo: ${maxLevel}/255`, 'info');
          addLog(`🎤 ${maxLevel > 10 ? 'Microfone está capturando áudio' : 'Microfone silencioso'}`, maxLevel > 10 ? 'success' : 'warning');
          
          // Limpar recursos
          stream.getTracks().forEach(track => track.stop());
          audioContext.close();
        }
      };
      
      checkLevel();
      
    } catch (error) {
      addLog(`🎤 Erro ao acessar microfone: ${error.message}`, 'error');
    }
  };

  // Função para limpar logs
  const clearLogs = () => {
    setLogs([]);
  };

  return (
    <div className="app-wrapper">
      <Toaster position="top-right" />
      
      {/* Top Header Section */}
      <div className="top-header">
        <h1 className="app-title">Wavoip Frontend</h1>
      </div>

      {/* Main Content Area (Left and Right Panels) */}
      <div className="main-content-panels">
        {/* Painel Esquerdo - Controles */}
        <div className="left-panel">

      {/* Seção de Tokens */}
      <div className="card">
        <div className="card-header">
          <h2>
            <Phone size={14} style={{ marginRight: '4px', display: 'inline' }} />
            Tokens dos Dispositivos
          </h2>
          <button onClick={addToken} className="btn-icon" title="Adicionar Token">
            <Plus size={14} />
          </button>
        </div>

        {tokens.length > 0 && (
          <div style={{ marginTop: '16px' }}>
            {tokens.map((token, index) => (
              <div key={index} style={{ 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'space-between',
                padding: '12px',
                background: '#f9fafb',
                borderRadius: '8px',
                marginBottom: '8px'
              }}>
                <span style={{ fontFamily: 'monospace', color: '#374151' }}>
                  {token.substring(0, 20)}...
                </span>
                <button 
                  onClick={() => removeToken(index)}
                  className="btn btn-danger"
                  style={{ padding: '4px 8px', fontSize: '12px' }}
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
          </div>
        )}

        <div style={{ marginTop: '16px' }}>
          <button 
            onClick={initializeWavoip} 
            className="btn"
            disabled={isConnecting || tokens.length === 0}
          >
            {isConnecting ? (
              <>
                <div className="loading" style={{ marginRight: '8px' }}></div>
                Conectando...
              </>
            ) : (
              'Conectar Dispositivos'
            )}
          </button>
        </div>
      </div>

      {/* Seção de Números de Telefone */}
      <div className="card">
        <div className="card-header">
          <h2>
            <Phone size={14} style={{ marginRight: '4px', display: 'inline' }} />
            Números de Telefone
          </h2>
          <button onClick={addPhoneNumber} className="btn-icon" title="Adicionar Número">
            <Plus size={14} />
          </button>
        </div>

        {phoneNumbers.length > 0 && (
          <div className="phone-list">
            {phoneNumbers.map((number, index) => (
              <div key={index} className="phone-item">
                <span>{number}</span>
                <button onClick={() => removePhoneNumber(index)}>
                  <X size={12} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Seção de Upload de Arquivo */}
      <div className="card">
        <h2>
          <Upload size={14} style={{ marginRight: '4px', display: 'inline' }} />
          Arquivo de Áudio
        </h2>
        
        <div 
          {...getRootProps()} 
          className={`file-upload ${isDragActive ? 'dragover' : ''}`}
          onClick={openFileDialog}
          style={{ cursor: 'pointer' }}
        >
          <input {...getInputProps()} ref={fileInputRef} />
          <Upload size={24} style={{ color: '#9ca3af', marginBottom: '4px' }} />
          <p style={{ color: '#6b7280', marginBottom: '2px', fontSize: '11px' }}>
            {isDragActive 
              ? 'Solte o arquivo aqui...' 
              : 'Arraste um arquivo de áudio aqui ou clique para selecionar'
            }
          </p>
          <p style={{ color: '#9ca3af', fontSize: '9px' }}>
            Formatos suportados: MP3, WAV, OGG, M4A, AAC
          </p>
        </div>

        {uploadedFile && (
          <div className="file-info">
            <div style={{ display: 'flex', alignItems: 'center' }}>
              <Volume2 style={{ marginRight: '8px', color: '#667eea' }} />
              <span>{uploadedFile.name}</span>
              <span style={{ marginLeft: '8px', color: '#6b7280' }}>
                ({(uploadedFile.size / 1024 / 1024).toFixed(2)} MB)
              </span>
            </div>
            <button 
              onClick={() => setUploadedFile(null)}
              className="btn btn-secondary"
              style={{ padding: '4px 8px', fontSize: '12px' }}
            >
              <X size={16} />
            </button>
          </div>
        )}
      </div>

      {/* Seção de Dispositivos */}
      {Object.keys(wavoipInstances).length > 0 && (
        <div className="card">
        <h2>
          <CheckCircle size={14} style={{ marginRight: '4px', display: 'inline' }} />
          Status dos Dispositivos
        </h2>
          
          <div className="device-list">
            {Object.entries(wavoipInstances).map(([token, instance], index) => {
              const device = devices.find(d => d.token === token);
              return (
                <div 
                  key={token} 
                  className={`device-item ${device?.status || 'offline'}`}
                >
                  <div style={{ display: 'flex', alignItems: 'center', marginBottom: '12px' }}>
                    <span className={`status-indicator status-${device?.status || 'offline'}`}></span>
                    <span style={{ fontWeight: '600' }}>
                      {instance.inbox_name}
                    </span>
                  </div>
                  
                  <div style={{ fontFamily: 'monospace', fontSize: '10px', color: '#6b7280', marginBottom: '6px' }}>
                    {token.substring(0, 20)}...
                  </div>
                  
                  <div style={{ fontSize: '11px', marginBottom: '6px' }}>
                    Status: <strong>{device?.status || 'Desconectado'}</strong>
                  </div>

                  {device?.status === 'online' && phoneNumbers.length > 0 && (
                    <div>
                      <p style={{ fontSize: '11px', marginBottom: '4px', color: '#374151' }}>
                        Fazer chamada para:
                      </p>
                      {phoneNumbers.map((number, phoneIndex) => (
                        <button
                          key={phoneIndex}
                          onClick={() => makeCall(token, number)}
                          className="btn btn-success"
                          style={{ 
                            marginRight: '4px', 
                            marginBottom: '4px',
                            padding: '4px 8px',
                            fontSize: '10px'
                          }}
                          disabled={callInfo.id}
                        >
                          <Phone size={10} style={{ marginRight: '2px' }} />
                          {number}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Controles de Chamada Ativa */}
      {callInfo.id && (
        <div className="card">
        <h2>
          <Phone size={14} style={{ marginRight: '4px', display: 'inline' }} />
          {callInfo.status === 'offer' ? 'Chamada Recebida' : 'Chamada Ativa'}
        </h2>
          
          {/* Informações da chamada */}
          <div style={{ marginBottom: '12px', textAlign: 'center' }}>
            <div style={{ marginBottom: '8px' }}>
              <img 
                src={callInfo.picture_profile || '/default-avatar.png'} 
                alt="Profile" 
                style={{ 
                  width: '50px', 
                  height: '50px', 
                  borderRadius: '50%',
                  objectFit: 'cover',
                  marginBottom: '6px'
                }}
                onError={(e) => {
                  e.target.style.display = 'none';
                }}
              />
            </div>
            <h3 style={{ marginBottom: '4px', color: '#374151', fontSize: '14px' }}>
              {callInfo.tag || 'Desconhecido'}
            </h3>
            <p style={{ color: '#6b7280', marginBottom: '4px', fontSize: '12px' }}>
              {callInfo.phone}
            </p>
            <p style={{ color: '#667eea', fontWeight: '600', fontSize: '11px' }}>
              Status: {callInfo.status}
            </p>
            {isPlayingAudio && (
              <div style={{ 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center',
                marginTop: '4px',
                padding: '4px 8px',
                background: '#10b981',
                color: 'white',
                borderRadius: '12px',
                fontSize: '11px'
              }}>
                <Volume2 size={12} style={{ marginRight: '4px' }} />
                🎵 Transmitindo áudio na chamada
              </div>
            )}
          </div>
          
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', justifyContent: 'center' }}>
            {callInfo.status === 'offer' ? (
              <>
                <button 
                  onClick={acceptCall}
                  className="btn btn-success"
                  style={{ padding: '4px 8px', fontSize: '10px' }}
                >
                  <Phone size={10} style={{ marginRight: '3px' }} />
                  Aceitar
                </button>
                
                <button 
                  onClick={rejectCall}
                  className="btn btn-danger"
                  style={{ padding: '4px 8px', fontSize: '10px' }}
                >
                  <PhoneOff size={10} style={{ marginRight: '3px' }} />
                  Rejeitar
                </button>
              </>
            ) : (
              <>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                  <button 
                    onClick={() => {
                      testAudioPlayback();
                      setTimeout(() => replaceMicrophoneWithMP3(callInfo.whatsapp_instance), 500);
                      setTimeout(() => forceMicrophoneCapture(callInfo.whatsapp_instance), 2000);
                      setTimeout(() => playAudioSimple(callInfo.whatsapp_instance), 1000);
                      setTimeout(() => playAudioWithHTMLOptimized(callInfo.whatsapp_instance), 4000);
                    }}
                    className="btn btn-success"
                    style={{ padding: '4px 8px', fontSize: '10px' }}
                    disabled={isPlayingAudio}
                  >
                    <Play size={10} style={{ marginRight: '3px' }} />
                    {isPlayingAudio ? 'Reproduzindo...' : 'Injetar Áudio'}
                  </button>
                </div>
                
                <button 
                  onClick={endCall}
                  className="btn btn-danger"
                  style={{ padding: '4px 8px', fontSize: '10px' }}
                >
                  <PhoneOff size={10} style={{ marginRight: '3px' }} />
                  Finalizar Chamada
                </button>
              </>
            )}
          </div>
        </div>
      )}

      </div>

      {/* Painel Direito - Logs */}
      <div className="right-panel">
        <div className="logs-container">
          <div className="logs-header">
            <h2 className="logs-title">
              <AlertCircle style={{ marginRight: '8px', display: 'inline' }} />
              Logs do Sistema
            </h2>
            <button onClick={clearLogs} className="btn btn-secondary" style={{ padding: '6px 12px', fontSize: '12px' }}>
              Limpar Logs
            </button>
          </div>
          
          <div className="logs">
            {logs.length === 0 ? (
              <div style={{ color: '#6b7280', textAlign: 'center', padding: '20px' }}>
                Nenhum log disponível
              </div>
            ) : (
              logs.map((log, index) => (
                <div key={index} className={`log-entry ${log.type}`}>
                  <span style={{ color: '#9ca3af' }}>[{log.timestamp}]</span> {log.message}
                </div>
              ))
            )}
          </div>
        </div>
      </div>
      </div>
    </div>
  );
}

export default App;
