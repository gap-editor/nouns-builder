import { Flex, Text } from '@zoralabs/zord'
import axios from 'axios'
import React, { useState } from 'react'
import useSWR, { mutate } from 'swr'
import { useAccount } from 'wagmi'

import SWR_KEYS from 'src/constants/swrKeys'
import {
  ProposalState,
  getProposalState,
} from 'src/data/contract/requests/getProposalState'
import {
  CurrentAuctionFragment,
  DaoFragment,
  ProposalFragment,
} from 'src/data/subgraph/sdk.generated'
import { CHAIN_ID } from 'src/typings'

import { DaoAuctionCard } from './DaoAuctionCard'
import { DaoProposals } from './DaoProposals'
import { DashboardLayout } from './DashboardLayout'

const ACTIVE_PROPOSAL_STATES = [
  ProposalState.Active,
  ProposalState.Pending,
  ProposalState.Queued,
]

export type DashboardDao = DaoFragment & {
  chainId: CHAIN_ID
  daoImage: string
  auctionConfig: {
    minimumBidIncrement: string
    reservePrice: string
  }
  proposals: ProposalFragment[]
  currentAuction: CurrentAuctionFragment
}

const fetchDaoProposalState = async (dao: DashboardDao) => {
  const proposals = await Promise.all(
    dao.proposals.map(async (proposal) => {
      const proposalState = await getProposalState(
        dao.chainId,
        proposal.dao.governorAddress,
        proposal.proposalId
      )
      return { ...proposal, proposalState }
    })
  )
  return {
    ...dao,
    proposals: proposals.filter((proposal) =>
      ACTIVE_PROPOSAL_STATES.includes(proposal.proposalState)
    ),
  }
}

const fetchDashboardData = async (address: string) => {
  const userDaos = await axios
    .get<DashboardDao[]>(`/api/dashboard/${address}`)
    .then((x) => x.data)

  const resolved = await Promise.all(userDaos.map(fetchDaoProposalState))
  return resolved
}

const Dashboard = () => {
  const { address } = useAccount()

  const { data, error, isValidating } = useSWR(
    [`${SWR_KEYS.DASHBOARD}:${address}`],
    address ? () => fetchDashboardData(address) : null,
    { revalidateOnFocus: false }
  )

  const [mutating, setMutating] = useState(false)

  if (error) {
    return <div>error</div>
  }
  if (isValidating && !mutating) {
    return <div>loading</div>
  }
  if (!address) {
    return <div>no address</div>
  }
  if (!data) {
    return <div>no data</div>
  }

  const handleMutate = async () => {
    setMutating(true)
    await mutate([`${SWR_KEYS.DASHBOARD}:${address}`], () => fetchDashboardData(address))
    setMutating(false)
  }

  const hasLiveProposals = data.some((dao) => dao.proposals.length)

  return (
    <DashboardLayout
      auctionCards={data?.map((dao) => (
        <DaoAuctionCard
          key={`${dao.tokenAddress}:${dao.currentAuction.token.tokenId}`}
          {...dao}
          userAddress={address}
          handleMutate={handleMutate}
        />
      ))}
      daoProposals={
        hasLiveProposals ? (
          data
            .filter((dao) => dao.proposals.length)
            .map((dao) => <DaoProposals key={dao.tokenAddress} {...dao} />)
        ) : (
          <Flex
            borderRadius={'phat'}
            borderStyle={'solid'}
            height={'x32'}
            width={'100%'}
            borderWidth={'normal'}
            borderColor={'border'}
            direction={'column'}
            justify={'center'}
            align={'center'}
          >
            <Text fontSize={20} fontWeight={'display'} mb="x4" color={'text3'}>
              No Active Proposals
            </Text>
            <Text color={'text3'}>
              Currently, none of your DAOs have proposals that are in active, queue, or
              pending states. Check back later!
            </Text>
          </Flex>
        )
      }
    />
  )
}

export default Dashboard
