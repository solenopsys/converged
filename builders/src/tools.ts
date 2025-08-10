import { readdirSync, statSync, mkdirSync } from "fs";


async function uploadToS3(prefix: string,filePath: string) {
    const fileName = filePath.split('/').pop();
    console.log(`Uploading ${fileName} to S3...`);
    try {
        await Bun.$`aws s3 cp ${filePath} s3://converged-modules/${prefix}/${fileName}`;
        console.log(`✅ ${fileName} uploaded successfully.`);
    } catch (error) {
        console.error(`❌ Failed to upload ${fileName}:`, error);
        throw error; // Propagate error to stop the script
    }
}

const fileSize = (p: string) => {
    try {
      return `${(statSync(p).size / 1024).toFixed(1)}kb`;
    } catch {
      return "0kb";
    }
  };
  



export { uploadToS3,fileSize};
