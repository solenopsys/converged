import React from 'react';
import { useParams, useNavigate, Outlet } from 'react-router-dom';
import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarFooter
} from 'converged-core';
import { Button } from 'converged-core';
import { X } from 'lucide-react';

const MailSidebar = ({ side = "right", backPath, onClose }) => {
  const navigate = useNavigate();

  const handleClose = () => {
    if (onClose) {
      onClose();
    } else {
      navigate('.');
    }
  };

  return (
    <Sidebar side={side} className="w-96">
      <SidebarHeader>
        <div className="flex items-center justify-between p-4">
          <h2 className="text-lg font-semibold">Письмо</h2>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleClose}
            className="h-8 w-8 p-0"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </SidebarHeader>
      
      <SidebarContent>
        <div className="p-4">
          <Outlet />
        </div>
      </SidebarContent>
    </Sidebar>
  );
};

export default MailSidebar;