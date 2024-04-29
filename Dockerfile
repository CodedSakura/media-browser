FROM node:20-alpine
LABEL authors="codedsakura"

WORKDIR /app

COPY . .

RUN apk update && apk add --no-cache file
RUN yarn

EXPOSE 80
ENTRYPOINT ["yarn", "start"]
