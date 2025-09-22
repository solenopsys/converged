# id шники

threadId - ulid
messageId - ulid

# типы type
  - message
  - link
  - partitionN

# связи 

messageid -> beforeId

# данные
threadId:messageId ->  json {
    type:"",
    data:"",
    user: ""
    timestamp: ""
}

userId:messageId -> json { threadId, timestamp, isDeleted?, isEdited?, reactions? }





# головы 
threadId:head:N -> messageid



в sqlite можно хранить 1 воркспейсы 2 полнотекстовый индекс 3 статистику, 4 настройки юзеров


