import { useState } from "react";
import { Settings, Key, Eye, EyeOff, Save, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription,
} from "@/components/ui/dialog";
import { toast } from "sonner";

interface ApiKey {
  name: string;
  key: string;
}

const EXCHANGES = [
  { id: 'polymarket', name: 'Polymarket', placeholder: 'pm-api-...' },
  { id: 'binance', name: 'Binance', placeholder: 'binance-api-key' },
  { id: 'coinbase', name: 'Coinbase', placeholder: 'coinbase-api-key' },
];

const ApiKeySettings = () => {
  const [keys, setKeys] = useState<Record<string, string>>(() => {
    try {
      return JSON.parse(localStorage.getItem('trading-api-keys') || '{}');
    } catch {
      return {};
    }
  });
  const [visible, setVisible] = useState<Record<string, boolean>>({});

  const saveKey = (exchangeId: string, value: string) => {
    const updated = { ...keys, [exchangeId]: value };
    setKeys(updated);
    localStorage.setItem('trading-api-keys', JSON.stringify(updated));
    toast.success('API key saved securely');
  };

  const deleteKey = (exchangeId: string) => {
    const updated = { ...keys };
    delete updated[exchangeId];
    setKeys(updated);
    localStorage.setItem('trading-api-keys', JSON.stringify(updated));
    toast.success('API key removed');
  };

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-foreground">
          <Settings className="w-4 h-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="bg-background border-border/50 max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Key className="w-4 h-4 text-primary" />
            API Key Management
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Connect your exchange accounts for live trading. Keys are stored locally in your browser.
            For production use, enable Lovable Cloud for encrypted server-side storage.
          </DialogDescription>
        </DialogHeader>
        
        <div className="flex flex-col gap-4 mt-2">
          {EXCHANGES.map((exchange) => (
            <div key={exchange.id} className="flex flex-col gap-2">
              <label className="text-xs font-medium text-foreground">{exchange.name}</label>
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <Input
                    type={visible[exchange.id] ? 'text' : 'password'}
                    placeholder={exchange.placeholder}
                    value={keys[exchange.id] || ''}
                    onChange={(e) => setKeys(prev => ({ ...prev, [exchange.id]: e.target.value }))}
                    className="pr-8 bg-secondary/50 border-border/50 text-sm"
                  />
                  <button
                    onClick={() => setVisible(prev => ({ ...prev, [exchange.id]: !prev[exchange.id] }))}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {visible[exchange.id] ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => saveKey(exchange.id, keys[exchange.id] || '')}
                  className="text-primary hover:text-primary"
                >
                  <Save className="w-3.5 h-3.5" />
                </Button>
                {keys[exchange.id] && (
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => deleteKey(exchange.id)}
                    className="text-destructive hover:text-destructive"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ApiKeySettings;
