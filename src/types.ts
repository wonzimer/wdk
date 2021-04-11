import { BigNumberish } from '@ethersproject/bignumber'
import { BytesLike } from '@ethersproject/bytes'

/**
 * Wonzimer Media Protocol BidShares
 */
export type BidShares = {
  creator: BigNumberish
  galery: BigNumberish
  owner: BigNumberish
  prevOwner: BigNumberish
}

/**
 * Wonzimer Media Protocol Ask
 */
export type Ask = {
  currency: string
  amount: BigNumberish
}

/**
 * Wonzimer Media Protocol Bid
 */
export type Bid = {
  currency: string
  amount: BigNumberish
  bidder: string
  recipient: string
}

/**
 * Wonzimer Media Protocol MediaData
 */
export type MediaData = {
  tokenURI: string
  metadataURI: string
  contentHash: BytesLike
  metadataHash: BytesLike
}

/**
 * EIP712 Signature
 */
export type EIP712Signature = {
  deadline: BigNumberish
  v: number
  r: BytesLike
  s: BytesLike
}

/**
 * EIP712 Domain
 */
export type EIP712Domain = {
  name: string
  version: string
  chainId: number
  verifyingContract: string
}
