Dev Mode Guia de Start

Objetivo
- Rodar frontend (Vite/TypeScript) em dev e backend Python em modo dev, para ver erros no console ao clicar na aba 3D.
- Abordagem: iniciar frontend e backend separadamente (diagnóstico claro); opção de script unificado no futuro se desejar.

Pré-requisitos
- Node.js e npm (frontend)
- Python (backend); uso opcional de virtualenv
- Acesso aos diretórios do projeto: frontend/ e prosolve/

Estrutura relevante do projeto
- Frontend: frontend (configuração Vite, dependencies JS/TS)
- Backend: prosolve (configuração Python, requisitos)
- Proxy opcional entre frontend e backend durante o dev

Como iniciar (passos diretos)
1) Backend (dev)
- Vá para: C:\Users\jorge\OneDrive\ProSolveSimulation\prosolve
- Se houver um ambiente virtual: abra o terminal e ative- o
- Instale dependências (se houver requirements.txt):
  pip install -r requirements.txt
- Inicie o servidor no modo dev (exemplos comuns):
  - Flask: set FLASK_ENV=development && flask run --port 8000
  - FastAPI/uvicorn: uvicorn main:app --reload --port 8000
- Observação: use o comando que o seu projeto utiliza; o objetivo é ter logs no console em modo dev.

2) Frontend (dev)
- Vá para: C:\Users\jorge\OneDrive\ProSolveSimulation\frontend
- Instale dependências: npm install
- Inicie o servidor de dev: npm run dev
- O frontend normalmente abre em http://localhost:5173 (porta padrão do Vite)
- Se não houver script dev, tente: npx vite

3) Proxy/CORS (quando necessário)
- Se o frontend precisa falar com o backend, configure um proxy no vite.config.ts apontando para http://localhost:8000, ou libere CORS no backend para o origin do dev server.

4) Verificação inicial
- Acesse http://localhost:5173 e clique na aba 3D.
- Abra as Ferramentas do Desenvolvedor (F12) e verifique Console e Network para erros.

5) Diagnóstico rápido de logs
- Console: procure por erros de renderização WebGL, falhas de carregamento de meshes, ou erros de CORS.
- Network: verifique se os recursos 3D (meshes, textures) estão carregando sem 404s ou timeouts.

6) Observações finais
- Este guia serve como ponto de partida para diagnóstico. Se aparecerem erros no console, copie o texto da mensagem de erro e o stack trace para analisarmos as causas.
- Caso queira, posso gerar patches automáticos para transformar este guia em um dev-start completo com scripts to-do.

Observação
- Este arquivo é apenas um guia de uso. Não alterei o código do projeto.
