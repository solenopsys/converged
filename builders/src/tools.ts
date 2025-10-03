import { readdirSync, statSync, mkdirSync } from "fs";


async function uploadToS3(prefix: string,filePath: string,targetPath:string) {
    const fileName = filePath.split('/').pop();
    console.log(`Uploading ${fileName} to S3...`);
    try {
        
        await Bun.$`aws s3 cp ${filePath} s3://converged-modules/${prefix}/${targetPath} `;
        console.log(`✅ ${fileName} uploaded successfully.`);
    } catch (error) {
        console.error(`❌ Failed to upload ${fileName}:`, error);
        throw error; // Propagate error to stop the script
    }
}

async function compressBrottly(filePath: string): Promise<string> {
  const compressedFilePath = `${filePath}.br`;
  // remove file
  try {
    await Bun.$`rm -f ${compressedFilePath}`;
  } catch (error) {
    // Игнорируем ошибку, файл может не существовать
  }
  
  console.log(`Compressing ${filePath} with Brotli level 9...`);
  
  try {
      await Bun.$`brotli -q 9 -o ${compressedFilePath} ${filePath}`;
      console.log(`✅ File compressed successfully: ${compressedFilePath}`);
      return compressedFilePath;
  } catch (error) {
      console.error(`❌ Failed to compress ${filePath}:`, error);
      throw error;
  }
}

const fileSize = (p: string) => {
    try {
      return `${(statSync(p).size / 1024).toFixed(1)}kb`;
    } catch {
      return "0kb";
    }
  };
  



export { uploadToS3,fileSize,compressBrottly};
