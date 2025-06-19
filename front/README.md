aws ecr-public create-repository --repository-name converged --region us-east-1
buildah bud  -t public.ecr.aws/i5x9u8b2/converged .
buildah push public.ecr.aws/i5x9u8b2/converged


json-server --watch db.json --port 3001

Паджинация 
GET /users?_page=2&_limit=10