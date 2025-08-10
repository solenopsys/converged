  
bun bld
aws ecr-public create-repository --repository-name converged --region us-east-1
buildah bud  -t public.ecr.aws/i5x9u8b2/converged .
buildah push public.ecr.aws/i5x9u8b2/converged

