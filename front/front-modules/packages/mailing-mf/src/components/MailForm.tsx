import React, { useState } from 'react';
import { Button } from "converged-core";
import { Input } from "converged-core";
import { Textarea } from "converged-core";
import { Label } from "converged-core";
import { Card, CardContent, CardHeader, CardTitle } from  "converged-core";

export default function EmailForm() {
  const [formData, setFormData] = useState({
    from: '',
    to: '',
    subject: '',
    body: ''
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = () => {
    console.log('Email data:', formData);
    // Здесь будет логика отправки письма
    alert('Письмо отправлено!');
  };

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle>Отправить письмо</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="from">От кого</Label>
            <Input
              id="from"
              name="from"
              type="email"
              value={formData.from}
              onChange={handleChange}
              placeholder="your-email@example.com"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="to">Кому</Label>
            <Input
              id="to"
              name="to"
              type="email"
              value={formData.to}
              onChange={handleChange}
              placeholder="recipient@example.com"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="subject">Тема</Label>
            <Input
              id="subject"
              name="subject"
              type="text"
              value={formData.subject}
              onChange={handleChange}
              placeholder="Тема письма"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="body">Сообщение</Label>
            <Textarea
              id="body"
              name="body"
              value={formData.body}
              onChange={handleChange}
              placeholder="Введите текст сообщения..."
              rows={8}
              required
            />
          </div>

          <Button onClick={handleSubmit} className="w-full">
            Отправить письмо
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}