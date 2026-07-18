FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY package*.json ./
RUN npm ci
COPY --from=build /app/dist ./dist
COPY --from=build /app/server ./server
COPY --from=build /app/src ./src
COPY --from=build /app/evals ./evals
COPY --from=build /app/fixtures ./fixtures
COPY --from=build /app/runner ./runner
COPY --from=build /app/scripts ./scripts
COPY --from=build /app/sdk ./sdk
EXPOSE 8787
CMD ["npm", "start"]
