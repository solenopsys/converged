 
import MailDetail from "../components/MailDetail";
import {Mail} from "../components/MailDetail";
import { Store } from "effector"; 
import {useUnit} from "effector-react";




export const MailDetailView = ({mailStore}: {mailStore: Store<any | null>}) => {
    const mail = useUnit(mailStore);

    console.log("MAIL RESULT", mail);
    
    if (!mail) {
        return <div>Письмо не найдено</div>;
    }

    const targetMail:Mail = {from:mail.from.value[0].address, to:mail.to.value[0].address, subject:mail.subject, date:mail.date};
    
    return <MailDetail mail={mail} />;
}