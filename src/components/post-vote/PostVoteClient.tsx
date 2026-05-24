"use client"

import { useCustomToast } from '@/hooks/use-custom-toast'
import { VoteType } from '@prisma/client'
import { FC, useRef, useState } from 'react'
import { Button } from '../ui/Button'
import { ArrowBigDown, ArrowBigUp } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { PostVoteRequest } from '@/lib/validator/vote'
import axios, { AxiosError } from 'axios'
import { toast } from '@/hooks/use-toast'
import { useRouter } from 'next/navigation'

interface PostVoteClientProps {
  postId: string
  initialVotesAmt: number
  initialVote?: VoteType | null
}

const PostVoteClient: FC<PostVoteClientProps> = ({ postId, initialVotesAmt, initialVote }) => {
  const { loginToast } = useCustomToast()
  const router = useRouter()
  const queryClient = useQueryClient()

  const [currentVote, setCurrentVote] = useState(initialVote)
  const currentVoteRef = useRef(currentVote)

  // Sync currentVote when initialVote prop changes (e.g. after session loads)
  const [prevInitialVote, setPrevInitialVote] = useState(initialVote)
  if (prevInitialVote !== initialVote) {
    setPrevInitialVote(initialVote)
    setCurrentVote(initialVote)
    currentVoteRef.current = initialVote
  }

  // Derive the displayed count: initial total ± the difference between current and initial vote
  const contrib = (v: VoteType | null | undefined) => (v === 'UP' ? 1 : v === 'DOWN' ? -1 : 0)
  const votesAmt = initialVotesAmt + contrib(currentVote) - contrib(initialVote)

  const { mutate: vote, isLoading } = useMutation({
    mutationFn: async (voteType: VoteType) => {
      const payload: PostVoteRequest = { postId, voteType }
      await axios.patch('/api/subreddit/post/vote', payload)
    },
    onError: (err, _voteType, context: any) => {
      currentVoteRef.current = context?.previousVote
      setCurrentVote(context?.previousVote)

      if (err instanceof AxiosError) {
        if (err.response?.status === 401) return loginToast()
      }

      return toast({
        title: 'Something went wrong.',
        description: 'Your vote was not registered. Please try again.',
        variant: 'destructive',
      })
    },
    onSuccess: () => {
      router.refresh()
      queryClient.invalidateQueries(['infinite-query'])
    },
    onMutate: (type: VoteType) => {
      const previousVote = currentVoteRef.current

      if (currentVoteRef.current === type) {
        // Same direction — toggle off
        currentVoteRef.current = undefined
        setCurrentVote(undefined)
      } else {
        // No vote or opposite vote — switch to new type
        currentVoteRef.current = type
        setCurrentVote(type)
      }

      return { previousVote }
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
