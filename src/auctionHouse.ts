import { BigNumber, BigNumberish, ethers, Signer } from 'ethers'
import { Provider, TransactionReceipt } from '@ethersproject/providers'
import {
  AuctionHouse as AuctionHouseContract,
  AuctionHouseFactory,
} from '@wonzimer-nft/core/dist/typechain'
import rinkebyAddresses from '@wonzimer-nft/core/dist/addresses/4.json'
import mainnetAddresses from '@wonzimer-nft/core/dist/addresses/1.json'
import { addresses } from './addresses'
import { chainIdToNetworkName } from './utils'

const auctionHouseAddresses: { [key: string]: string } = {
  rinkeby: rinkebyAddresses.auctionHouse,
  mainnet: mainnetAddresses.auctionHouse,
}

export interface Auction {
  approved: boolean
  amount: BigNumber
  duration: BigNumber
  firstBidTime: BigNumber
  reservePrice: BigNumber
  curatorFeePercentage: number
  tokenOwner: string
  bidder: string
  curator: string
  auctionCurrency: string
}

export class AuctionHouse {
  public readonly chainId: number
  public readonly readOnly: boolean
  public readonly signerOrProvider: Signer | Provider
  public readonly auctionHouse: AuctionHouseContract
  public readonly mediaAddress: string

  constructor(signerOrProvider: Signer | Provider, chainId: number) {
    this.chainId = chainId
    this.readOnly = !Signer.isSigner(signerOrProvider)
    this.signerOrProvider = signerOrProvider
    const network = chainIdToNetworkName(chainId)
    const address = auctionHouseAddresses[network]
    this.auctionHouse = AuctionHouseFactory.connect(address, signerOrProvider)
    this.mediaAddress = addresses[network].media
  }

  public async fetchAuction(auctionId: BigNumberish): Promise<Auction> {
    return this.auctionHouse.auctions(auctionId)
  }

  public async fetchAuctionFromTransactionReceipt(
    receipt: TransactionReceipt
  ): Promise<Auction | null> {
    for (const log of receipt.logs) {
      const description = this.auctionHouse.interface.parseLog(log)

      if (description.args.auctionId && log.address === this.auctionHouse.address) {
        return this.fetchAuction(description.args.auctionId)
      }
    }

    return null
  }

  public async createAuction(
    tokenId: BigNumberish,
    duration: BigNumberish,
    reservePrice: BigNumberish,
    auctionCurrency: string,
    tokenAddress: string = this.mediaAddress
  ) {
    return this.auctionHouse.createAuction(
      tokenId,
      tokenAddress,
      duration,
      reservePrice,
      auctionCurrency
    )
  }

  public async createBid(auctionId: BigNumberish, amount: BigNumberish) {
    const { auctionCurrency } = await this.auctionHouse.auctions(auctionId)
    if (auctionCurrency === ethers.constants.AddressZero) {
      return this.auctionHouse.createBid(auctionId, amount, { value: amount })
    } else {
      return this.auctionHouse.createBid(auctionId, amount)
    }
  }

  public async endAuction(auctionId: BigNumberish) {
    return this.auctionHouse.endAuction(auctionId)
  }
}
