FROM node:18-alpine

WORKDIR /usr/src/app

COPY package*.json ./

RUN npm install

COPY . .

# Expose port for REST API
EXPOSE 3030
# Expose port for WebSocket
EXPOSE 3031

CMD ["npm", "start"]
