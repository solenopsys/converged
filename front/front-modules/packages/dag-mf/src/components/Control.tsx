
import { Tabs, TabsContent, TabsList, TabsTrigger } from "converged-core";


export default function ControlPanel() {
 
 


    return (
        <Tabs defaultValue="account" className="w-[400px]">
        <TabsList>
          <TabsTrigger value="account">Editor</TabsTrigger>
          <TabsTrigger value="password">Log</TabsTrigger>
        </TabsList>
        <TabsContent value="account">Make changes to your account here.</TabsContent>
        <TabsContent value="password">Change your password here.</TabsContent>
      </Tabs>
      
    );
  }
  