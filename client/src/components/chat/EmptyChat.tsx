import { MessageCircle, Plus } from 'lucide-react';

interface EmptyChatProps {
  onNewChat?: () => void;
}

export function EmptyChat({ onNewChat }: EmptyChatProps) {
  return (
    <div className="flex h-full flex-col items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-4 text-center">
        <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-gradient-to-br from-primary/20 to-accent/20">
          <MessageCircle className="h-10 w-10 text-primary" />
        </div>
        <div>
          <h2 className="text-xl font-semibold text-foreground">Welcome to Nasscord</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Select a conversation or start a new one
          </p>
        </div>
        {onNewChat && (
          <button
            onClick={onNewChat}
            className="mt-2 flex items-center gap-2 rounded-lg bg-primary/10 px-5 py-2.5 text-sm font-medium text-primary transition-colors hover:bg-primary/20"
          >
            <Plus className="h-4 w-4" />
            New Conversation
          </button>
        )}
      </div>
    </div>
  );
}
