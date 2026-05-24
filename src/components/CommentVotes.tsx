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

interface CommentVotesProps {
  commentId: string;
  votesAmt: number;
  currentVote?: PartialVote;
}

type PartialVote = Pick<CommentVote, "type">;

const CommentVotes: FC<CommentVotesProps> = ({
  commentId,
  votesAmt: _votesAmt,
  currentVote: _currentVote,
}) => {
  const { loginToast } = useCustomToast();
  const [votesAmt, setVotesAmt] = useState<number>(_votesAmt);
  const [currentVote, setCurrentVote] = useState<PartialVote | undefined>(_currentVote);

  // Refs mirror state so onMutate always reads the latest values,
  // not a stale closure from a previous render
  const currentVoteRef = useRef(currentVote);
  const votesAmtRef = useRef(votesAmt);

  const { mutate: vote, isLoading } = useMutation({
    mutationFn: async (type: VoteType) => {
      const payload: CommentVoteRequest = { voteType: type, commentId };
      await axios.patch("/api/subreddit/post/comment/vote", payload);
    },
    onError: (err, voteType, context: any) => {
      // Roll back to exact pre-click state using saved context
      currentVoteRef.current = context?.previousVote;
      setCurrentVote(context?.previousVote);
      votesAmtRef.current = context?.previousVotesAmt ?? _votesAmt;
      setVotesAmt(context?.previousVotesAmt ?? _votesAmt);

      if (err instanceof AxiosError) {
        if (err.response?.status === 401) return loginToast();
      }

      return toast({
        title: "Something went wrong.",
        description: "Your vote was not registered. Please try again.",
        variant: "destructive",
      });
    },
    onMutate: (type: VoteType) => {
      // Snapshot pre-click state for rollback
      const previousVote = currentVoteRef.current;
      const previousVotesAmt = votesAmtRef.current;

      if (currentVoteRef.current?.type === type) {
        // Same vote type — toggle off
        currentVoteRef.current = undefined;
        setCurrentVote(undefined);
        if (type === "UP") {
          votesAmtRef.current -= 1;
        } else if (type === "DOWN") {
          votesAmtRef.current += 1;
        }
      } else {
        // New vote or switching direction
        const hadVote = !!currentVoteRef.current;
        currentVoteRef.current = { type };
        setCurrentVote({ type });
        if (type === "UP") {
          votesAmtRef.current += hadVote ? 2 : 1;
        } else if (type === "DOWN") {
          votesAmtRef.current -= hadVote ? 2 : 1;
        }
      }

      setVotesAmt(votesAmtRef.current);
      return { previousVote, previousVotesAmt };
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
        className={cn({
          "text-emerald-500": currentVote?.type === "DOWN",
        })}
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
