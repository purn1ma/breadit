"use client"

import { useCustomToast } from '@/hooks/use-custom-toast'
import { VoteType } from '@prisma/client'
import { FC, useEffect, useRef, useState } from 'react'
import { Button } from '../ui/Button'
import { ArrowBigDown, ArrowBigUp } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useMutation } from '@tanstack/react-query'
import { PostVoteRequest } from '@/lib/validator/vote'
import axios, { AxiosError } from 'axios'
import { toast } from '@/hooks/use-toast'

interface PostVoteClientProps {
  postId: string
  initialVotesAmt: number
  initialVote?: VoteType | null
}

const PostVoteClient: FC<PostVoteClientProps> = ({postId, initialVotesAmt, initialVote}) => {
  const { loginToast } = useCustomToast()
  const [votesAmt, setVotesAmt] = useState(initialVotesAmt)
  const [currentVote, setCurrentVote] = useState(initialVote)

  // Refs mirror state so onMutate always reads the latest values,
  // not a stale closure from a previous render
  const currentVoteRef = useRef(currentVote)
  const votesAmtRef = useRef(votesAmt)

  useEffect(() => {
    setCurrentVote(initialVote)
    currentVoteRef.current = initialVote
  }, [initialVote])

  const { mutate: vote, isLoading } = useMutation({
    mutationFn: async (voteType: VoteType) => {
      const payload: PostVoteRequest = { postId, voteType }
      await axios.patch('/api/subreddit/post/vote', payload)
    },
    onError: (err, voteType, context: any) => {
      // Roll back to exact pre-click state using saved context
      currentVoteRef.current = context?.previousVote
      setCurrentVote(context?.previousVote)
      votesAmtRef.current = context?.previousVotesAmt ?? initialVotesAmt
      setVotesAmt(context?.previousVotesAmt ?? initialVotesAmt)

      if (err instanceof AxiosError) {
        if (err.response?.status === 401) return loginToast()
      }

      return toast({
        title: 'Something went wrong.',
        description: 'Your vote was not registered. Please try again.',
        variant: 'destructive',
      })
    },
    onMutate: (type: VoteType) => {
      const previousVote = currentVoteRef.current
      const previousVotesAmt = votesAmtRef.current

      if (currentVoteRef.current === type) {
        // Same direction — toggle off
        currentVoteRef.current = undefined
        setCurrentVote(undefined)
        if (type === 'UP') votesAmtRef.current -= 1
        else if (type === 'DOWN') votesAmtRef.current += 1
      } else {
        // No vote or opposite vote — switch to new type
        if (currentVoteRef.current === 'UP') votesAmtRef.current -= 1
        else if (currentVoteRef.current === 'DOWN') votesAmtRef.current += 1
        currentVoteRef.current = type
        setCurrentVote(type)
        if (type === 'UP') votesAmtRef.current += 1
        else if (type === 'DOWN') votesAmtRef.current -= 1
      }

      setVotesAmt(votesAmtRef.current)
      return { previousVote, previousVotesAmt }
    },
  })

  return (
    <div className='flex flex-col gap-4 sm:gap-0 pr-6 sm:w-20 pb-4 sm:pb-0'>
      <Button
        onClick={() => vote('UP')}
        disabled={isLoading}
        size='sm'
        variant='ghost'
        aria-label='upvote'>
        <ArrowBigUp
          className={cn('h-5 w-5 text-zinc-700', {
            'text-emerald-500 fill-emerald-500': currentVote === 'UP',
          })}
        />
      </Button>

      <p className='text-center py-2 font-medium text-sm text-zinc-900'>
        {votesAmt}
      </p>

      <Button
        onClick={() => vote('DOWN')}
        disabled={isLoading}
        size='sm'
        className={cn({
          'text-emerald-500': currentVote === 'DOWN',
        })}
        variant='ghost'
        aria-label='downvote'>
        <ArrowBigDown
          className={cn('h-5 w-5 text-zinc-700', {
            'text-red-500 fill-red-500': currentVote === 'DOWN',
          })}
        />
      </Button>
    </div>
  )
}

export default PostVoteClient
