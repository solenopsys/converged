 
import  MailForm  from "../components/MailForm";
import MailDetail    from "../components/MailDetail";

const SendMailCap = {
    description: "Отправка письма",
    views: [MailForm],
    show: ["right"],
    commands: { "sendMail": { name: open  } },

}

const MailDetailCap = {
    description: "Просмотр письма",
    views: [MailDetail],
    show: ["right"],
    commands: { "response": { name: open  } },

}

export { SendMailCap, MailDetailCap };