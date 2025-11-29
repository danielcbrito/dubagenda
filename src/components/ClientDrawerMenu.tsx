import { User, Gift, Calendar, Trophy, HeadphonesIcon, LogOut, Wallet } from "lucide-react";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { useState } from "react";
import { AppointmentHistorySheet } from "./AppointmentHistorySheet";
import { useNavigate } from "react-router-dom";

interface ClientDrawerMenuProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onLogout: () => void;
  profile: any;
  userId?: string;
  onProfileClick: () => void;
  onPlansClick: () => void;
  onPointsClick: () => void;
  onWalletClick: () => void;
}

export function ClientDrawerMenu({ 
  open, 
  onOpenChange, 
  onLogout, 
  profile,
  userId,
  onProfileClick,
  onPlansClick,
  onPointsClick,
  onWalletClick
}: ClientDrawerMenuProps) {
  const [historyOpen, setHistoryOpen] = useState(false);
  const navigate = useNavigate();

  const handleSupport = () => {
    onOpenChange(false);
    navigate("/suporte");
  };

  const menuItems = [
    {
      icon: User,
      label: "Meu Perfil",
      onClick: () => {
        onOpenChange(false);
        onProfileClick();
      }
    },
    {
      icon: Wallet,
      label: "Carteira / Créditos",
      onClick: () => {
        onOpenChange(false);
        onWalletClick();
      }
    },
    {
      icon: Gift,
      label: "Meus Planos",
      onClick: () => {
        onOpenChange(false);
        onPlansClick();
      }
    },
    {
      icon: Calendar,
      label: "Histórico de Agendamentos",
      onClick: () => {
        setHistoryOpen(true);
      }
    },
    {
      icon: Trophy,
      label: "Programa de Pontos",
      onClick: () => {
        onOpenChange(false);
        onPointsClick();
      }
    },
    {
      icon: HeadphonesIcon,
      label: "Suporte / Fale Conosco",
      onClick: handleSupport
    },
  ];

  return (
    <>
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent className="max-h-[80vh]">
          <DrawerHeader className="text-left">
            <DrawerTitle className="text-lg">Menu</DrawerTitle>
            <p className="text-xs text-muted-foreground">{profile?.nome}</p>
          </DrawerHeader>
          
          <div className="px-4 pb-6 space-y-2">
            {menuItems.map((item, index) => (
              <Button
                key={index}
                variant="ghost"
                className="w-full justify-start h-12 text-sm hover:bg-primary/10 transition-all duration-300"
                onClick={item.onClick}
              >
                <item.icon className="mr-3 h-5 w-5" />
                {item.label}
              </Button>
            ))}

            <Separator className="my-4" />

            <Button
              variant="ghost"
              className="w-full justify-start h-12 text-sm text-destructive hover:bg-destructive/10 transition-all duration-300"
              onClick={() => {
                onLogout();
                onOpenChange(false);
              }}
            >
              <LogOut className="mr-3 h-5 w-5" />
              Sair
            </Button>
          </div>
        </DrawerContent>
      </Drawer>

      <AppointmentHistorySheet
        open={historyOpen}
        onOpenChange={setHistoryOpen}
        userId={userId}
      />
    </>
  );
}
