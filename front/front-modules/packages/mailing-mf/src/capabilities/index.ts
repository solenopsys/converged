import { OutgoingMailsCap ,IcomingMailsCap,WarmMailsCap,CredentialsCap} from "./lists";
import { SendMailCap ,MailDetailCap} from "./comands";
import { DailyMailsStatisticCap } from "./statistic";
import { IncomMailsStatisticCap, IncomWarmStatisticCap } from "./statistic";
 


export const CAPABILITIES = {
    "outgoing_mails_list": OutgoingMailsCap,
    "incoming_mails_list": IcomingMailsCap,
    "warm_mails_list": WarmMailsCap,
    "credentials_smtp": CredentialsCap,
    "daily_mails_statistic": DailyMailsStatisticCap,
    "send_mail": SendMailCap,
    "mailDetail": MailDetailCap,
    "incoming_mails_count": IncomMailsStatisticCap,
    "incoming_warms_count": IncomWarmStatisticCap
}
 