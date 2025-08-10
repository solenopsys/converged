 
FROM oven/bun:1-alpine
WORKDIR /app

COPY package.json ./

 

COPY src/        ./src
COPY tgz/        ./tgz
COPY generated/  ./generated      
COPY tsconfig.json ./
RUN bun install  --production  



RUN bun run bld                   
 
 
RUN mkdir -p /app/data
RUN chown -R 1000:1000 /app
USER 1000:1000
CMD ["bun", "run", "dist/api.js"]
