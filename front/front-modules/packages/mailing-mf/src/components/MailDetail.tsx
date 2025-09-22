import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Badge } from "converged-core";
import { Separator } from "converged-core";
import { Avatar, AvatarFallback } from "converged-core";
import { Button } from "converged-core";
import { 
  Mail, 
  Reply, 
  ReplyAll, 
  Forward, 
  Archive, 
  Trash2, 
  Star,
  Paperclip,
  Calendar,
  User
} from 'lucide-react';

import mailingService from "../service";

export type Mail = {
  id: string;
  subject: string;
  date: string;
  from: { value: [{ name: string; address: string }] };
  to: { value: [{ name: string; address: string }] };
  attachments: any[];
  text: string;
  html: string;
}

const MailDetail = ({mail}: {mail:Mail}) => {
  

 

  if (!mail) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getInitials = (name, email) => {
    if (name && name.trim()) {
      return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
    }
    return email.split('@')[0].slice(0, 2).toUpperCase();
  };

  const fromAddress = mail.from?.value?.[0];
  const toAddress = mail.to?.value?.[0];

  return (
    <div className="h-full max-w-4xl mx-auto p-6 space-y-6">
      {/* Header Actions */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Mail className="h-5 w-5 text-muted-foreground" />
          <span className="text-sm text-muted-foreground">Mail #{mail.id}</span>
        </div>
        <div className="flex items-center space-x-2">
          <Button variant="outline" size="sm">
            <Reply className="h-4 w-4 mr-2" />
            Reply
          </Button>
        </div>
      </div>

      {/* Mail Content */}
      <div className="w-full">
        {/* Header */}
        <div className="pb-4">
          {/* Subject */}
          <h1 className="text-2xl font-bold leading-tight">{mail.subject}</h1>
          
          {/* Date and Attachments */}
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <div className="flex items-center space-x-2">
              <Calendar className="h-4 w-4" />
              <span>{formatDate(mail.date)}</span>
            </div>
            {mail.attachments && mail.attachments.length > 0 && (
              <Badge variant="secondary" className="flex items-center space-x-1">
                <Paperclip className="h-3 w-3" />
                <span>{mail.attachments.length} attachment{mail.attachments.length > 1 ? 's' : ''}</span>
              </Badge>
            )}
          </div>

          <Separator className="mt-4" />

          {/* From/To Information */}
          <div className="space-y-4 pt-4">
            {/* From */}
            <div className="flex items-start space-x-3">
              <div className="h-10 w-10 flex items-center justify-center">
                <User className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center space-x-2">
                  <span className="font-medium text-sm">From:</span>
                  <div>
                    <span className="font-semibold">
                      {fromAddress?.name || fromAddress?.address}
                    </span>
                    {fromAddress?.name && (
                      <span className="text-muted-foreground text-sm ml-2">
                        &lt;{fromAddress?.address}&gt;
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* To */}
            <div className="flex items-start space-x-3">
              <div className="h-10 w-10 flex items-center justify-center">
                <User className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center space-x-2">
                  <span className="font-medium text-sm">To:</span>
                  <div>
                    <span className="font-semibold">
                      {toAddress?.name || toAddress?.address}
                    </span>
                    {toAddress?.name && (
                      <span className="text-muted-foreground text-sm ml-2">
                        &lt;{toAddress?.address}&gt;
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Content */}
        <div>
          <Separator className="mb-6" />
          
          {/* Email Content */}
          <div className="prose prose-sm max-w-none">
            {mail.html && mail.html !== mail.text ? (
              <div 
                className="leading-relaxed"
                dangerouslySetInnerHTML={{ __html: mail.html }}
              />
            ) : (
              <div className="whitespace-pre-wrap leading-relaxed text-sm">
                {mail.text}
              </div>
            )}
          </div>

          {/* Attachments Section */}
          {mail.attachments && mail.attachments.length > 0 && (
            <div className="mt-8 pt-6 border-t">
              <h3 className="font-semibold mb-3 flex items-center">
                <Paperclip className="h-4 w-4 mr-2" />
                Attachments ({mail.attachments.length})
              </h3>
              <div className="space-y-2">
                {mail.attachments.map((attachment, index) => (
                  <div key={index} className="p-3 border rounded-lg">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <Paperclip className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm font-medium">
                          {attachment.filename || `Attachment ${index + 1}`}
                        </span>
                        {attachment.size && (
                          <span className="text-xs text-muted-foreground">
                            ({attachment.size} bytes)
                          </span>
                        )}
                      </div>
                      <Button variant="outline" size="sm">
                        Download
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default MailDetail;