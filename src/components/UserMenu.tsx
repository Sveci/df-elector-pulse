import { memo, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useDemoMask } from "@/contexts/DemoModeContext";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { 
  User, 
  Settings, 
  LogOut, 
  Shield,
  ChevronDown
} from "lucide-react";

const UserMenu = memo(function UserMenu() {
  const { user, logout } = useAuth();
  const { m } = useDemoMask();
  const navigate = useNavigate();
  const [showLogoutDialog, setShowLogoutDialog] = useState(false);

  if (!user) return null;

  const displayName = m.name(user.name);
  const displayEmail = m.email(user.email);
  const initials = displayName
    .split(" ")
    .map(n => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const handleLogout = () => {
    setShowLogoutDialog(false);
    logout();
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" className="flex items-center space-x-3 h-auto p-2">
            <Avatar className="h-8 w-8">
              <AvatarImage src={user.avatar} alt={displayName} />
              <AvatarFallback className="bg-primary-100 text-primary-700 text-sm font-medium">
                {initials}
              </AvatarFallback>
            </Avatar>
            
            <div className="flex flex-col items-start">
              <span className="text-sm font-medium text-gray-900">
                {displayName}
              </span>
              <Badge variant="secondary" className="text-xs">
                {user.role}
              </Badge>
            </div>
            
            <ChevronDown className="h-4 w-4 text-gray-500" />
          </Button>
        </DropdownMenuTrigger>

        <DropdownMenuContent align="end" className="w-64">
          <DropdownMenuLabel className="font-normal">
            <div className="flex flex-col space-y-2">
              <div className="flex items-center space-x-2">
                <Avatar className="h-10 w-10">
                  <AvatarImage src={user.avatar} alt={displayName} />
                  <AvatarFallback className="bg-primary-100 text-primary-700">
                    {initials}
                  </AvatarFallback>
                </Avatar>
                <div className="flex flex-col">
                  <p className="text-sm font-medium text-gray-900">
                    {displayName}
                  </p>
                  <p className="text-xs text-gray-500">
                    {displayEmail}
                  </p>
                </div>
              </div>
              <Badge variant="outline" className="self-start">
                {user.role}
              </Badge>
            </div>
          </DropdownMenuLabel>
          
          <DropdownMenuSeparator />
          
          <DropdownMenuItem className="cursor-pointer" onClick={() => navigate("/settings/profile")}>
            <User className="mr-2 h-4 w-4" />
            <span>Perfil</span>
          </DropdownMenuItem>
          
          <DropdownMenuItem className="cursor-pointer" onClick={() => navigate("/settings")}>
            <Settings className="mr-2 h-4 w-4" />
            <span>Configurações</span>
          </DropdownMenuItem>
          
          <DropdownMenuItem className="cursor-pointer" onClick={() => navigate("/settings/privacy")}>
            <Shield className="mr-2 h-4 w-4" />
            <span>Privacidade</span>
          </DropdownMenuItem>
          
          <DropdownMenuSeparator />
          
          <DropdownMenuItem 
            className="cursor-pointer text-red-600 focus:text-red-600"
            onClick={() => setShowLogoutDialog(true)}
          >
            <LogOut className="mr-2 h-4 w-4" />
            <span>Sair</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog open={showLogoutDialog} onOpenChange={setShowLogoutDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar Logout</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja sair da plataforma? Você precisará fazer login novamente para acessar o sistema.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleLogout}
              className="bg-red-600 hover:bg-red-700 focus:ring-red-600"
            >
              Confirmar Logout
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
});

export default UserMenu;