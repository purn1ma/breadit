"use client";
import { Button } from "@/components/ui/Button";
import { toast } from "@/hooks/use-toast";
import { useCustomToast } from "@/hooks/use-custom-toast";
import { cn } from "@/lib/utils";
import { CommentVoteRequest } from "@/lib/validator/vote";
import { CommentVote, VoteType } from "@prisma/client";
import { useMutation } from "@tanstack/react-query";
import axios, { AxiosError } from "axios";
import { ArrowBigDown, ArrowBigUp } from "lucide-react";
import { FC, useRef, useState } from "react";
import { useRouter } from "next/navigation";

interface CommentVotesProps {
  commentId: string;
  votesAmt: number;
  currentVote?: PartialVote;
}

type PartialVote = Pick<CommentVote, "type">;

const CommentVotes: FC<CommentVotesProps> = ({
  commentId,
  votesAmt: initialVotesAmt,
  currentVote: initialVote,
}) => {
  const { loginToast } = useCustomToast();
  const router = useRouter();

  const [currentVote, setCurrentVote] = useState<PartialVote | undefined>(initialVote);
  const currentVoteRef = useRef(currentVote);

  // Sync currentVote when initialVote prop changes (e.g. after router.refresh())
  const [prevInitialVote, setPrevInitialVote] = useState(initialVote);
  if (prevInitialVote?.type !== initialVote?.type) {
    setPrevInitialVote(initialVote);
    setCurrentVote(initialVote);
    currentVoteRef.current = initialVote;
  }

  // Derive the displayed count: initial total ± the difference between current and initial vote
  const contrib = (v: PartialVote | undefined) => (v?.type === "UP" ? 1 : v?.type === "DOWN" ? -1 : 0);
  const votesAmt = initialVotesAmt + contrib(currentVote) - contrib(initialVote);

  const { mutate: vote, isLoading } = useMutation({
    mutationFn: async (type: VoteType) => {
      const payload: CommentVoteRequest = { voteType: type, commentId };
      await axios.patch("/api/subreddit/post/comment/vote", payload);
    },
    onError: (err, _voteType, context: any) => {
      currentVoteRef.current = context?.previousVote;
      setCurrentVote(context?.previousVote);

      if (err instanceof AxiosError) {
        if (err.response?.status === 401) return loginToast();
      }

      return toast({
        title: "Something went wrong.",
        description: "Your vote was not registered. Please try again.",
        variant: "destructive",
      });
    },
    onSuccess: () => {
      router.refresh();
    },
    onMutate: (type: VoteType) => {
      const previousVote = currentVoteRef.current;

      if (currentVoteRef.current?.type === type) {
        // Same direction — toggle off
        currentVoteRef.current = undefined;
        setCurrentVote(undefined);
      } else {
        // No vote or opposite vote — switch to new type
        currentVoteRef.current = { type };
        setCurrentVote({ type });
      }

      return { previousVote };
    },
  });

  return (
    <div className="flex gap-1">
      <Button
        onClick={() => vote("UP")}
        disabled={isLoading}
        size="xs"
        variant="ghost"
        aria-label="upvote"
      >
        <ArrowBigUp
          className={cn("h-5 w-5 text-zinc-700", {
            "text-emerald-500 fill-emerald-500": currentVote?.type === "UP",
          })}
        />
      </Button>

      <p className="text-center py-2 px-1 font-medium text-xs text-zinc-900">
        {votesAmt}
      </p>

      <Button
        onClick={() => vote("DOWN")}
        disabled={isLoading}
        size="xs"
        variant="ghost"
        aria-label="downvote"
      >
        <ArrowBigDown
          className={cn("h-5 w-5 text-zinc-700", {
            "text-red-500 fill-red-500": currentVote?.type === "DOWN",
          })}
        />
      </Button>
    </div>
  );
};

export default CommentVotes;
