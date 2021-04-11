import {
  Ask,
  Bid,
  constructAsk,
  constructBid,
  constructMediaData,
  EIP712Signature,
  generateMetadata,
  MediaData,
  sha256FromBuffer,
  signMintWithSigMessage,
  signPermitMessage,
  Wonzimer,
} from '../src'
import { JsonRpcProvider } from '@ethersproject/providers'
import { Wallet } from '@ethersproject/wallet'
import { addresses as WonzimerAddresses } from '../src/addresses'
import { deployCurrency, setupWonzimer, WonzimerConfiguredAddresses } from './helpers'
import { Blockchain, generatedWallets } from '@wonzimer/core/dist/utils'
import { BigNumber, Bytes } from 'ethers'
import { formatUnits } from 'ethers/lib/utils'
import { AddressZero } from '@ethersproject/constants'
import { MediaFactory } from '@wonzimer/core/dist/typechain'
import MockAdapter from 'axios-mock-adapter'
import axios from 'axios'
import { promises as fs } from 'fs'

let provider = new JsonRpcProvider()
let blockchain = new Blockchain(provider)
jest.setTimeout(1000000)

describe('Wonzimer', () => {
  describe('#constructor', () => {
    it('throws an error if a mediaAddress is specified but not a marketAddress', () => {
      const wallet = Wallet.createRandom()
      expect(function () {
        new Wonzimer(wallet, 4, '0x1D7022f5B17d2F8B695918FB48fa1089C9f85401')
      }).toThrow(
        'Wonzimer Constructor: mediaAddress and marketAddress must both be non-null or both be null'
      )
    })

    it('throws an error if the marketAddress is specified but not a mediaAddress', () => {
      const wallet = Wallet.createRandom()
      expect(function () {
        new Wonzimer(wallet, 4, '', '0x1D7022f5B17d2F8B695918FB48fa1089C9f85401')
      }).toThrow(
        'Wonzimer Constructor: mediaAddress and marketAddress must both be non-null or both be null'
      )
    })

    it('throws an error if one of the market or media addresses in not a valid ethereum address', () => {
      const wallet = Wallet.createRandom()
      expect(function () {
        new Wonzimer(
          wallet,
          4,
          'not a valid ethereum address',
          '0x1D7022f5B17d2F8B695918FB48fa1089C9f85401'
        )
      }).toThrow('Invariant failed: not a valid ethereum address is not a valid address')

      expect(function () {
        new Wonzimer(
          wallet,
          4,
          '0x1D7022f5B17d2F8B695918FB48fa1089C9f85401',
          'not a valid ethereum address'
        )
      }).toThrow('Invariant failed: not a valid ethereum address is not a valid address')
    })

    it('throws an error if the chainId does not map to a network with deployed instance of the Wonzimer Protocol', () => {
      const wallet = Wallet.createRandom()

      expect(function () {
        new Wonzimer(wallet, 50)
      }).toThrow(
        'Invariant failed: chainId 50 not officially supported by the Wonzimer Protocol'
      )
    })

    it('throws an error if the chainId does not map to a network with deployed instance of the Wonzimer Protocol', () => {
      const wallet = Wallet.createRandom()

      expect(function () {
        new Wonzimer(
          wallet,
          50,
          '0x1D7022f5B17d2F8B695918FB48fa1089C9f85401',
          '0x1dC4c1cEFEF38a777b15aA20260a54E584b16C48'
        )
      }).not.toThrow(
        'Invariant failed: chainId 50 not officially supported by the Wonzimer Protocol'
      )
    })

    it('sets the Wonzimer instance to readOnly = false if a signer is specified', () => {
      const wallet = Wallet.createRandom()

      const wonzimer = new Wonzimer(
        wallet,
        50,
        '0x1D7022f5B17d2F8B695918FB48fa1089C9f85401',
        '0x1dC4c1cEFEF38a777b15aA20260a54E584b16C48'
      )
      expect(wonzimer.readOnly).toBe(false)
    })

    it('sets the Wonzimer instance to readOnly = true if a signer is specified', () => {
      const provider = new JsonRpcProvider()

      const wonzimer = new Wonzimer(
        provider,
        50,
        '0x1D7022f5B17d2F8B695918FB48fa1089C9f85401',
        '0x1dC4c1cEFEF38a777b15aA20260a54E584b16C48'
      )
      expect(wonzimer.readOnly).toBe(true)
    })

    it('initializes a Wonzimer instance with the checksummed media and market address for the specified chainId', () => {
      const wallet = Wallet.createRandom()
      const rinkebyMediaAddress = WonzimerAddresses['rinkeby'].media
      const rinkebyMarketAddress = WonzimerAddresses['rinkeby'].market
      const wonzimer = new Wonzimer(wallet, 4)
      expect(wonzimer.marketAddress).toBe(rinkebyMarketAddress)
      expect(wonzimer.mediaAddress).toBe(rinkebyMediaAddress)
      expect(wonzimer.market.address).toBe(rinkebyMarketAddress)
      expect(wonzimer.media.address).toBe(rinkebyMediaAddress)
    })

    it('initializes a Wonzimer instance with the specified media and market address if they are passed in', () => {
      const wallet = Wallet.createRandom()
      const mediaAddress = '0x1D7022f5B17d2F8B695918FB48fa1089C9f85401'
      const marketAddress = '0x1dC4c1cEFEF38a777b15aA20260a54E584b16C48'

      const wonzimer = new Wonzimer(wallet, 50, mediaAddress, marketAddress)
      expect(wonzimer.readOnly).toBe(false)
      expect(wonzimer.marketAddress).toBe(marketAddress)
      expect(wonzimer.mediaAddress).toBe(mediaAddress)
      expect(wonzimer.market.address).toBe(marketAddress)
      expect(wonzimer.media.address).toBe(mediaAddress)

      const wonzimer1 = new Wonzimer(wallet, 50, mediaAddress, marketAddress)
      expect(wonzimer1.readOnly).toBe(false)
      expect(wonzimer1.marketAddress).toBe(marketAddress)
      expect(wonzimer1.mediaAddress).toBe(mediaAddress)
      expect(wonzimer1.market.address).toBe(marketAddress)
      expect(wonzimer1.media.address).toBe(mediaAddress)
    })
  })

  describe('contract functions', () => {
    let wonzimerConfig: WonzimerConfiguredAddresses
    let provider = new JsonRpcProvider()
    let [mainWallet, otherWallet] = generatedWallets(provider)
    //let mainWallet = generatedWallets(provider)[0]

    beforeEach(async () => {
      await blockchain.resetAsync()
      wonzimerConfig = await setupWonzimer(mainWallet, [otherWallet])
    })

    /******************
     * Write Functions
     ******************
     */

    describe('Write Functions', () => {
      let contentHash: string
      let contentHashBytes: Bytes
      let metadataHash: string
      let metadataHashBytes: Bytes
      let metadata: any
      let minifiedMetadata: string

      let defaultMediaData: MediaData
      let defaultAsk: Ask
      let defaultBid: Bid
      let eipSig: EIP712Signature

      beforeEach(() => {
        metadata = {
          version: 'wonzimer-20210101',
          name: 'blah blah',
          description: 'blah blah blah',
          mimeType: 'text/plain',
        }
        minifiedMetadata = generateMetadata(metadata.version, metadata)
        metadataHash = sha256FromBuffer(Buffer.from(minifiedMetadata))
        contentHash = sha256FromBuffer(Buffer.from('invert'))

        defaultMediaData = constructMediaData(
          'https://example.com',
          'https://metadata.com',
          contentHash,
          metadataHash
        )
        defaultAsk = constructAsk(wonzimerConfig.currency, BigNumber.from(100))
        defaultBid = constructBid(
          wonzimerConfig.currency,
          BigNumber.from(99),
          otherWallet.address,
          otherWallet.address
        )

        eipSig = {
          deadline: 1000,
          v: 0,
          r: '0x00',
          s: '0x00',
        }
      })

      describe('#updateContentURI', () => {
        it('throws an error if called on a readOnly Wonzimer instance', async () => {
          const provider = new JsonRpcProvider()

          const wonzimer = new Wonzimer(
            provider,
            50,
            wonzimerConfig.media,
            wonzimerConfig.market
          )
          expect(wonzimer.readOnly).toBe(true)

          await expect(wonzimer.updateContentURI(0, 'new uri')).rejects.toBe(
            'ensureNotReadOnly: readOnly Wonzimer instance cannot call contract methods that require a signer.'
          )
        })

        it('throws an error if the tokenURI does not begin with `https://`', async () => {
          const wonzimer = new Wonzimer(
            otherWallet,
            50,
            wonzimerConfig.media,
            wonzimerConfig.market
          )
          await wonzimer.mint(defaultMediaData)
          await expect(wonzimer.updateContentURI(0, 'http://example.com')).rejects.toBe(
            'Invariant failed: http://example.com must begin with `https://`'
          )
        })

        it('updates the content uri', async () => {
          const mainWonzimer = new Wonzimer(
            mainWallet,
            50,
            wonzimerConfig.media,
            wonzimerConfig.market
          )
          await mainWonzimer.mint(defaultMediaData)

          const tokenURI = await mainWonzimer.fetchContentURI(0)
          expect(tokenURI).toEqual(defaultMediaData.tokenURI)

          await mainWonzimer.updateContentURI(0, 'https://newURI.com')

          const newTokenURI = await mainWonzimer.fetchContentURI(0)
          expect(newTokenURI).toEqual('https://newURI.com')
        })
      })

      describe('#updateMetadataURI', () => {
        it('throws an error if called on a readOnly Wonzimer instance', async () => {
          const provider = new JsonRpcProvider()

          const wonzimer = new Wonzimer(
            provider,
            50,
            wonzimerConfig.media,
            wonzimerConfig.market
          )
          expect(wonzimer.readOnly).toBe(true)

          await expect(wonzimer.updateMetadataURI(0, 'new uri')).rejects.toBe(
            'ensureNotReadOnly: readOnly Wonzimer instance cannot call contract methods that require a signer.'
          )
        })

        it('throws an error if the metadataURI does not begin with `https://`', async () => {
          const wonzimer = new Wonzimer(
            otherWallet,
            50,
            wonzimerConfig.media,
            wonzimerConfig.market
          )
          await wonzimer.mint(defaultMediaData)
          await expect(wonzimer.updateMetadataURI(0, 'http://example.com')).rejects.toBe(
            'Invariant failed: http://example.com must begin with `https://`'
          )
        })

        it('updates the metadata uri', async () => {
          const mainWonzimer = new Wonzimer(
            mainWallet,
            50,
            wonzimerConfig.media,
            wonzimerConfig.market
          )
          await mainWonzimer.mint(defaultMediaData)

          const metadataURI = await mainWonzimer.fetchMetadataURI(0)
          expect(metadataURI).toEqual(defaultMediaData.metadataURI)

          await mainWonzimer.updateMetadataURI(0, 'https://newMetadataURI.com')

          const newMetadataURI = await mainWonzimer.fetchMetadataURI(0)
          expect(newMetadataURI).toEqual('https://newMetadataURI.com')
        })
      })

      describe('#mint', () => {
        it('throws an error if called on a readOnly Wonzimer instance', async () => {
          const provider = new JsonRpcProvider()

          const wonzimer = new Wonzimer(
            provider,
            50,
            wonzimerConfig.media,
            wonzimerConfig.market
          )
          expect(wonzimer.readOnly).toBe(true)

          await expect(wonzimer.mint(defaultMediaData)).rejects.toBe(
            'ensureNotReadOnly: readOnly Wonzimer instance cannot call contract methods that require a signer.'
          )
        })

        it('throws an error if the tokenURI does not begin with `https://`', async () => {
          const wonzimer = new Wonzimer(
            otherWallet,
            50,
            wonzimerConfig.media,
            wonzimerConfig.market
          )
          const invalidMediaData = {
            tokenURI: 'http://example.com',
            metadataURI: 'https://metadata.com',
            contentHash: contentHashBytes,
            metadataHash: metadataHashBytes,
          }
          expect(wonzimer.readOnly).toBe(false)

          await expect(wonzimer.mint(invalidMediaData)).rejects.toBe(
            'Invariant failed: http://example.com must begin with `https://`'
          )
        })

        it('throws an error if the metadataURI does not begin with `https://`', async () => {
          const wonzimer = new Wonzimer(
            otherWallet,
            50,
            wonzimerConfig.media,
            wonzimerConfig.market
          )
          const invalidMediaData = {
            tokenURI: 'https://example.com',
            metadataURI: 'http://metadata.com',
            contentHash: contentHashBytes,
            metadataHash: metadataHashBytes,
          }
          expect(wonzimer.readOnly).toBe(false)

          await expect(wonzimer.mint(invalidMediaData)).rejects.toBe(
            'Invariant failed: http://metadata.com must begin with `https://`'
          )
        })

        it('pads the gas limit by 10%', async () => {
          const otherWonzimerConfig = await setupWonzimer(otherWallet, [mainWallet])
          const wonzimerMedia = MediaFactory.connect(wonzimerConfig.media, mainWallet)
          const tx = await wonzimerMedia.mint(defaultMediaData)
          const otherWonzimer = new Wonzimer(
            otherWallet,
            50,
            otherWonzimerConfig.media,
            otherWonzimerConfig.market
          )
          const paddedTx = await otherWonzimer.mint(defaultMediaData)

          expect(paddedTx.gasLimit).toEqual(tx.gasLimit.mul(110).div(100))
        })

        it('creates a new piece of media', async () => {
          const mainWonzimer = new Wonzimer(
            mainWallet,
            50,
            wonzimerConfig.media,
            wonzimerConfig.market
          )
          const totalSupply = await mainWonzimer.fetchTotalMedia()
          expect(totalSupply.toNumber()).toEqual(0)

          await mainWonzimer.mint(defaultMediaData)

          const owner = await mainWonzimer.fetchOwnerOf(0)
          const creator = await mainWonzimer.fetchCreator(0)
          const onChainContentHash = await mainWonzimer.fetchContentHash(0)
          const onChainMetadataHash = await mainWonzimer.fetchMetadataHash(0)

          const onChainContentURI = await mainWonzimer.fetchContentURI(0)
          const onChainMetadataURI = await mainWonzimer.fetchMetadataURI(0)

          expect(owner.toLowerCase()).toBe(mainWallet.address.toLowerCase())
          expect(creator.toLowerCase()).toBe(mainWallet.address.toLowerCase())
          expect(onChainContentHash).toBe(contentHash)
          expect(onChainContentURI).toBe(defaultMediaData.tokenURI)
          expect(onChainMetadataURI).toBe(defaultMediaData.metadataURI)
          expect(onChainMetadataHash).toBe(metadataHash)
        })
      })

      describe('#mintWithSig', () => {
        it('throws an error if called on a readOnly Wonzimer instance', async () => {
          const provider = new JsonRpcProvider()

          const wonzimer = new Wonzimer(
            provider,
            50,
            wonzimerConfig.media,
            wonzimerConfig.market
          )
          expect(wonzimer.readOnly).toBe(true)

          await expect(
            wonzimer.mintWithSig(otherWallet.address, defaultMediaData, eipSig)
          ).rejects.toBe(
            'ensureNotReadOnly: readOnly Wonzimer instance cannot call contract methods that require a signer.'
          )
        })

        it('throws an error if the tokenURI does not begin with `https://`', async () => {
          const wonzimer = new Wonzimer(
            otherWallet,
            50,
            wonzimerConfig.media,
            wonzimerConfig.market
          )
          const invalidMediaData = {
            tokenURI: 'http://example.com',
            metadataURI: 'https://metadata.com',
            contentHash: contentHashBytes,
            metadataHash: metadataHashBytes,
          }
          expect(wonzimer.readOnly).toBe(false)

          await expect(
            wonzimer.mintWithSig(otherWallet.address, invalidMediaData, eipSig)
          ).rejects.toBe(
            'Invariant failed: http://example.com must begin with `https://`'
          )
        })

        it('throws an error if the metadataURI does not begin with `https://`', async () => {
          const wonzimer = new Wonzimer(
            otherWallet,
            50,
            wonzimerConfig.media,
            wonzimerConfig.market
          )
          const invalidMediaData = {
            tokenURI: 'https://example.com',
            metadataURI: 'http://metadata.com',
            contentHash: contentHashBytes,
            metadataHash: metadataHashBytes,
          }
          expect(wonzimer.readOnly).toBe(false)

          await expect(wonzimer.mint(invalidMediaData)).rejects.toBe(
            'Invariant failed: http://metadata.com must begin with `https://`'
          )
        })

        it('creates a new piece of media', async () => {
          const otherWonzimer = new Wonzimer(
            otherWallet,
            50,
            wonzimerConfig.media,
            wonzimerConfig.market
          )
          const deadline = Math.floor(new Date().getTime() / 1000) + 60 * 60 * 24 // 24 hours
          const domain = otherWonzimer.eip712Domain()
          const nonce = await otherWonzimer.fetchMintWithSigNonce(mainWallet.address)
          const eipSig = await signMintWithSigMessage(
            mainWallet,
            contentHash,
            metadataHash,
            nonce.toNumber(),
            deadline,
            domain
          )

          const totalSupply = await otherWonzimer.fetchTotalMedia()
          expect(totalSupply.toNumber()).toEqual(0)

          await otherWonzimer.mintWithSig(mainWallet.address, defaultMediaData, eipSig)

          const owner = await otherWonzimer.fetchOwnerOf(0)
          const creator = await otherWonzimer.fetchCreator(0)
          const onChainContentHash = await otherWonzimer.fetchContentHash(0)
          const onChainMetadataHash = await otherWonzimer.fetchMetadataHash(0)

          const onChainContentURI = await otherWonzimer.fetchContentURI(0)
          const onChainMetadataURI = await otherWonzimer.fetchMetadataURI(0)

          expect(owner.toLowerCase()).toBe(mainWallet.address.toLowerCase())
          expect(creator.toLowerCase()).toBe(mainWallet.address.toLowerCase())
          expect(onChainContentHash).toBe(contentHash)
          expect(onChainContentURI).toBe(defaultMediaData.tokenURI)
          expect(onChainMetadataURI).toBe(defaultMediaData.metadataURI)
          expect(onChainMetadataHash).toBe(metadataHash)
        })
      })

      describe('#setAsk', () => {
        it('throws an error if called on a readOnly Wonzimer instance', async () => {
          const provider = new JsonRpcProvider()

          const wonzimer = new Wonzimer(
            provider,
            50,
            wonzimerConfig.media,
            wonzimerConfig.market
          )
          expect(wonzimer.readOnly).toBe(true)

          await expect(wonzimer.setAsk(0, defaultAsk)).rejects.toBe(
            'ensureNotReadOnly: readOnly Wonzimer instance cannot call contract methods that require a signer.'
          )
        })

        it('sets an ask for a piece of media', async () => {
          const mainWonzimer = new Wonzimer(
            mainWallet,
            50,
            wonzimerConfig.media,
            wonzimerConfig.market
          )
          await mainWonzimer.mint(defaultMediaData)

          await mainWonzimer.setAsk(0, defaultAsk)

          const onChainAsk = await mainWonzimer.fetchCurrentAsk(0)
          expect(onChainAsk.currency.toLowerCase()).toEqual(
            defaultAsk.currency.toLowerCase()
          )
          expect(parseFloat(formatUnits(onChainAsk.amount, 'wei'))).toEqual(
            parseFloat(formatUnits(defaultAsk.amount, 'wei'))
          )
        })
      })

      describe('#setBid', () => {
        it('throws an error if called on a readOnly Wonzimer instance', async () => {
          const provider = new JsonRpcProvider()

          const wonzimer = new Wonzimer(
            provider,
            50,
            wonzimerConfig.media,
            wonzimerConfig.market
          )
          expect(wonzimer.readOnly).toBe(true)

          await expect(wonzimer.setBid(0, defaultBid)).rejects.toBe(
            'ensureNotReadOnly: readOnly Wonzimer instance cannot call contract methods that require a signer.'
          )
        })

        it('creates a new bid on chain', async () => {
          const mainWonzimer = new Wonzimer(
            mainWallet,
            50,
            wonzimerConfig.media,
            wonzimerConfig.market
          )
          await mainWonzimer.mint(defaultMediaData)

          const otherWonzimer = new Wonzimer(
            otherWallet,
            50,
            wonzimerConfig.media,
            wonzimerConfig.market
          )
          const nullOnChainBid = await otherWonzimer.fetchCurrentBidForBidder(
            0,
            otherWallet.address
          )

          expect(nullOnChainBid.currency).toEqual(AddressZero)

          await otherWonzimer.setBid(0, defaultBid)
          const onChainBid = await otherWonzimer.fetchCurrentBidForBidder(
            0,
            otherWallet.address
          )

          expect(parseFloat(formatUnits(onChainBid.amount, 'wei'))).toEqual(
            parseFloat(formatUnits(onChainBid.amount, 'wei'))
          )
          expect(onChainBid.currency.toLowerCase()).toEqual(
            defaultBid.currency.toLowerCase()
          )
          expect(onChainBid.bidder.toLowerCase()).toEqual(defaultBid.bidder.toLowerCase())
          expect(onChainBid.recipient.toLowerCase()).toEqual(
            defaultBid.recipient.toLowerCase()
          )
        })
      })

      describe('#removeAsk', () => {
        it('throws an error if called on a readOnly Wonzimer instance', async () => {
          const provider = new JsonRpcProvider()

          const wonzimer = new Wonzimer(
            provider,
            50,
            wonzimerConfig.media,
            wonzimerConfig.market
          )
          expect(wonzimer.readOnly).toBe(true)

          await expect(wonzimer.removeAsk(0)).rejects.toBe(
            'ensureNotReadOnly: readOnly Wonzimer instance cannot call contract methods that require a signer.'
          )
        })

        it('removes an ask', async () => {
          const mainWonzimer = new Wonzimer(
            mainWallet,
            50,
            wonzimerConfig.media,
            wonzimerConfig.market
          )
          await mainWonzimer.mint(defaultMediaData)
          await mainWonzimer.setAsk(0, defaultAsk)

          const onChainAsk = await mainWonzimer.fetchCurrentAsk(0)
          expect(onChainAsk.currency.toLowerCase()).toEqual(
            defaultAsk.currency.toLowerCase()
          )

          await mainWonzimer.removeAsk(0)

          const nullOnChainAsk = await mainWonzimer.fetchCurrentAsk(0)
          expect(nullOnChainAsk.currency).toEqual(AddressZero)
        })
      })

      describe('#removeBid', () => {
        it('throws an error if called on a readOnly Wonzimer instance', async () => {
          const provider = new JsonRpcProvider()

          const wonzimer = new Wonzimer(
            provider,
            50,
            wonzimerConfig.media,
            wonzimerConfig.market
          )
          expect(wonzimer.readOnly).toBe(true)

          await expect(wonzimer.removeBid(0)).rejects.toBe(
            'ensureNotReadOnly: readOnly Wonzimer instance cannot call contract methods that require a signer.'
          )
        })

        it('removes a bid', async () => {
          const mainWonzimer = new Wonzimer(
            mainWallet,
            50,
            wonzimerConfig.media,
            wonzimerConfig.market
          )
          await mainWonzimer.mint(defaultMediaData)
          const otherWonzimer = new Wonzimer(
            otherWallet,
            50,
            wonzimerConfig.media,
            wonzimerConfig.market
          )
          await otherWonzimer.setBid(0, defaultBid)
          const onChainBid = await otherWonzimer.fetchCurrentBidForBidder(
            0,
            otherWallet.address
          )

          expect(parseFloat(formatUnits(onChainBid.amount, 'wei'))).toEqual(
            parseFloat(formatUnits(onChainBid.amount, 'wei'))
          )
          expect(onChainBid.currency.toLowerCase()).toEqual(
            defaultBid.currency.toLowerCase()
          )
          expect(onChainBid.bidder.toLowerCase()).toEqual(defaultBid.bidder.toLowerCase())
          expect(onChainBid.recipient.toLowerCase()).toEqual(
            defaultBid.recipient.toLowerCase()
          )

          await otherWonzimer.removeBid(0)

          const nullOnChainBid = await otherWonzimer.fetchCurrentBidForBidder(
            0,
            otherWallet.address
          )

          expect(nullOnChainBid.currency).toEqual(AddressZero)
        })
      })

      describe('#acceptBid', () => {
        it('throws an error if called on a readOnly Wonzimer instance', async () => {
          const provider = new JsonRpcProvider()

          const wonzimer = new Wonzimer(
            provider,
            50,
            wonzimerConfig.media,
            wonzimerConfig.market
          )
          expect(wonzimer.readOnly).toBe(true)

          await expect(wonzimer.acceptBid(0, defaultBid)).rejects.toBe(
            'ensureNotReadOnly: readOnly Wonzimer instance cannot call contract methods that require a signer.'
          )
        })

        it('accepts a bid', async () => {
          const mainWonzimer = new Wonzimer(
            mainWallet,
            50,
            wonzimerConfig.media,
            wonzimerConfig.market
          )
          await mainWonzimer.mint(defaultMediaData)
          const otherWonzimer = new Wonzimer(
            otherWallet,
            50,
            wonzimerConfig.media,
            wonzimerConfig.market
          )
          await otherWonzimer.setBid(0, { ...defaultBid, amount: 110 })
          await mainWonzimer.acceptBid(0, { ...defaultBid, amount: 110 })
          const newOwner = await otherWonzimer.fetchOwnerOf(0)
          expect(newOwner.toLowerCase()).toEqual(otherWallet.address.toLowerCase())
        })
      })

      describe('#permit', () => {
        it('throws an error if called on a readOnly Wonzimer instance', async () => {
          const provider = new JsonRpcProvider()

          const wonzimer = new Wonzimer(
            provider,
            50,
            wonzimerConfig.media,
            wonzimerConfig.market
          )
          expect(wonzimer.readOnly).toBe(true)

          await expect(wonzimer.permit(otherWallet.address, 0, eipSig)).rejects.toBe(
            'ensureNotReadOnly: readOnly Wonzimer instance cannot call contract methods that require a signer.'
          )
        })

        it('grants approval to a different address', async () => {
          const mainWonzimer = new Wonzimer(
            mainWallet,
            50,
            wonzimerConfig.media,
            wonzimerConfig.market
          )
          await mainWonzimer.mint(defaultMediaData)
          const otherWonzimer = new Wonzimer(
            otherWallet,
            50,
            wonzimerConfig.media,
            wonzimerConfig.market
          )

          const deadline = Math.floor(new Date().getTime() / 1000) + 60 * 60 * 24 // 24 hours
          const domain = mainWonzimer.eip712Domain()
          const eipSig = await signPermitMessage(
            mainWallet,
            otherWallet.address,
            0,
            0,
            deadline,
            domain
          )

          await otherWonzimer.permit(otherWallet.address, 0, eipSig)
          const approved = await otherWonzimer.fetchApproved(0)
          expect(approved.toLowerCase()).toBe(otherWallet.address.toLowerCase())
        })
      })

      describe('#revokeApproval', () => {
        it('throws an error if called on a readOnly Wonzimer instance', async () => {
          const provider = new JsonRpcProvider()

          const wonzimer = new Wonzimer(
            provider,
            50,
            wonzimerConfig.media,
            wonzimerConfig.market
          )
          expect(wonzimer.readOnly).toBe(true)

          await expect(wonzimer.revokeApproval(0)).rejects.toBe(
            'ensureNotReadOnly: readOnly Wonzimer instance cannot call contract methods that require a signer.'
          )
        })

        it("revokes an addresses approval of another address's media", async () => {
          const mainWonzimer = new Wonzimer(
            mainWallet,
            50,
            wonzimerConfig.media,
            wonzimerConfig.market
          )
          await mainWonzimer.mint(defaultMediaData)
          await mainWonzimer.approve(otherWallet.address, 0)
          const approved = await mainWonzimer.fetchApproved(0)
          expect(approved.toLowerCase()).toBe(otherWallet.address.toLowerCase())

          const otherWonzimer = new Wonzimer(
            otherWallet,
            50,
            wonzimerConfig.media,
            wonzimerConfig.market
          )
          await otherWonzimer.revokeApproval(0)
          const nullApproved = await mainWonzimer.fetchApproved(0)
          expect(nullApproved).toBe(AddressZero)
        })
      })

      describe('#burn', () => {
        it('throws an error if called on a readOnly Wonzimer instance', async () => {
          const provider = new JsonRpcProvider()

          const wonzimer = new Wonzimer(
            provider,
            50,
            wonzimerConfig.media,
            wonzimerConfig.market
          )
          expect(wonzimer.readOnly).toBe(true)

          await expect(wonzimer.burn(0)).rejects.toBe(
            'ensureNotReadOnly: readOnly Wonzimer instance cannot call contract methods that require a signer.'
          )
        })

        it('burns a piece of media', async () => {
          const mainWonzimer = new Wonzimer(
            mainWallet,
            50,
            wonzimerConfig.media,
            wonzimerConfig.market
          )
          await mainWonzimer.mint(defaultMediaData)

          const owner = await mainWonzimer.fetchOwnerOf(0)
          expect(owner.toLowerCase()).toEqual(mainWallet.address.toLowerCase())

          const totalSupply = await mainWonzimer.fetchTotalMedia()
          expect(totalSupply.toNumber()).toEqual(1)

          await mainWonzimer.burn(0)

          const zeroSupply = await mainWonzimer.fetchTotalMedia()
          expect(zeroSupply.toNumber()).toEqual(0)
        })
      })

      describe('#approve', () => {
        it('throws an error if called on a readOnly Wonzimer instance', async () => {
          const provider = new JsonRpcProvider()

          const wonzimer = new Wonzimer(
            provider,
            50,
            wonzimerConfig.media,
            wonzimerConfig.market
          )
          expect(wonzimer.readOnly).toBe(true)

          await expect(wonzimer.approve(otherWallet.address, 0)).rejects.toBe(
            'ensureNotReadOnly: readOnly Wonzimer instance cannot call contract methods that require a signer.'
          )
        })

        it('grants approval for another address for a piece of media', async () => {
          const mainWonzimer = new Wonzimer(
            mainWallet,
            50,
            wonzimerConfig.media,
            wonzimerConfig.market
          )
          await mainWonzimer.mint(defaultMediaData)
          const nullApproved = await mainWonzimer.fetchApproved(0)
          expect(nullApproved).toBe(AddressZero)
          await mainWonzimer.approve(otherWallet.address, 0)
          const approved = await mainWonzimer.fetchApproved(0)
          expect(approved.toLowerCase()).toBe(otherWallet.address.toLowerCase())
        })
      })

      describe('#setApprovalForAll', () => {
        it('throws an error if called on a readOnly Wonzimer instance', async () => {
          const provider = new JsonRpcProvider()

          const wonzimer = new Wonzimer(
            provider,
            50,
            wonzimerConfig.media,
            wonzimerConfig.market
          )
          expect(wonzimer.readOnly).toBe(true)

          await expect(
            wonzimer.setApprovalForAll(otherWallet.address, true)
          ).rejects.toBe(
            'ensureNotReadOnly: readOnly Wonzimer instance cannot call contract methods that require a signer.'
          )
        })

        it('sets approval for another address for all media owned by owner', async () => {
          const mainWonzimer = new Wonzimer(
            mainWallet,
            50,
            wonzimerConfig.media,
            wonzimerConfig.market
          )
          await mainWonzimer.mint(defaultMediaData)
          const notApproved = await mainWonzimer.fetchIsApprovedForAll(
            mainWallet.address,
            otherWallet.address
          )
          expect(notApproved).toBe(false)
          await mainWonzimer.setApprovalForAll(otherWallet.address, true)
          const approved = await mainWonzimer.fetchIsApprovedForAll(
            mainWallet.address,
            otherWallet.address
          )
          expect(approved).toBe(true)

          await mainWonzimer.setApprovalForAll(otherWallet.address, false)
          const revoked = await mainWonzimer.fetchIsApprovedForAll(
            mainWallet.address,
            otherWallet.address
          )
          expect(revoked).toBe(false)
        })
      })

      describe('#transferFrom', () => {
        it('throws an error if called on a readOnly Wonzimer instance', async () => {
          const provider = new JsonRpcProvider()

          const wonzimer = new Wonzimer(
            provider,
            50,
            wonzimerConfig.media,
            wonzimerConfig.market
          )
          expect(wonzimer.readOnly).toBe(true)

          await expect(
            wonzimer.transferFrom(mainWallet.address, otherWallet.address, 0)
          ).rejects.toBe(
            'ensureNotReadOnly: readOnly Wonzimer instance cannot call contract methods that require a signer.'
          )
        })

        it('transfers media to another address', async () => {
          const mainWonzimer = new Wonzimer(
            mainWallet,
            50,
            wonzimerConfig.media,
            wonzimerConfig.market
          )
          await mainWonzimer.mint(defaultMediaData)
          const owner = await mainWonzimer.fetchOwnerOf(0)
          expect(owner.toLowerCase()).toEqual(mainWallet.address.toLowerCase())

          await mainWonzimer.transferFrom(mainWallet.address, otherWallet.address, 0)
          const newOwner = await mainWonzimer.fetchOwnerOf(0)
          expect(newOwner.toLowerCase()).toEqual(otherWallet.address.toLowerCase())
        })
      })

      describe('#safeTransferFrom', () => {
        it('throws an error if called on a readOnly Wonzimer instance', async () => {
          const provider = new JsonRpcProvider()

          const wonzimer = new Wonzimer(
            provider,
            50,
            wonzimerConfig.media,
            wonzimerConfig.market
          )
          expect(wonzimer.readOnly).toBe(true)

          await expect(
            wonzimer.safeTransferFrom(mainWallet.address, otherWallet.address, 0)
          ).rejects.toBe(
            'ensureNotReadOnly: readOnly Wonzimer instance cannot call contract methods that require a signer.'
          )
        })
      })

      describe('#eip712Domain', () => {
        it('returns chainId 1 on a local blockchain', () => {
          const provider = new JsonRpcProvider()

          const wonzimer = new Wonzimer(
            provider,
            50,
            wonzimerConfig.media,
            wonzimerConfig.market
          )
          const domain = wonzimer.eip712Domain()
          expect(domain.chainId).toEqual(1)
          expect(domain.verifyingContract.toLowerCase()).toEqual(
            wonzimer.mediaAddress.toLowerCase()
          )
        })

        it('returns the wonzimer chainId', () => {
          const provider = new JsonRpcProvider()
          const wonzimer = new Wonzimer(
            provider,
            4,
            wonzimerConfig.media,
            wonzimerConfig.market
          )
          const domain = wonzimer.eip712Domain()

          expect(domain.chainId).toEqual(4)
          expect(domain.verifyingContract.toLowerCase()).toEqual(
            wonzimer.mediaAddress.toLowerCase()
          )
        })
      })

      describe('#isValidBid', () => {
        it('returns true if the bid amount can be evenly split by current bidShares', async () => {
          const wonzimer = new Wonzimer(
            mainWallet,
            50,
            wonzimerConfig.media,
            wonzimerConfig.market
          )
          await wonzimer.mint(defaultMediaData)
          const isValid = await wonzimer.isValidBid(0, { ...defaultBid, amount: 100 })
          expect(isValid).toEqual(true)
        })

        it('returns false if the bid amount cannot be evenly split by current bidShares', async () => {
          const cur = await deployCurrency(mainWallet, 'CUR', 'CUR', 2)
          const wonzimer = new Wonzimer(
            mainWallet,
            50,
            wonzimerConfig.media,
            wonzimerConfig.market
          )
          const bid = constructBid(
            cur,
            BigNumber.from(201),
            otherWallet.address,
            otherWallet.address
          )

          await wonzimer.mint(defaultMediaData)
          const isValid = await wonzimer.isValidBid(0, bid)
          expect(isValid).toEqual(false)
        })
      })

      describe('#isValidAsk', () => {
        it('returns true if the ask amount can be evenly split by current bidShares', async () => {
          const wonzimer = new Wonzimer(
            mainWallet,
            50,
            wonzimerConfig.media,
            wonzimerConfig.market
          )
          await wonzimer.mint(defaultMediaData)
          const isValid = await wonzimer.isValidAsk(0, defaultAsk)
          expect(isValid).toEqual(true)
        })

        it('returns false if the ask amount cannot be evenly split by current bidShares', async () => {
          const cur = await deployCurrency(mainWallet, 'CUR', 'CUR', 2)
          const wonzimer = new Wonzimer(
            mainWallet,
            50,
            wonzimerConfig.media,
            wonzimerConfig.market
          )
          const ask = constructAsk(cur, BigNumber.from(201))

          await wonzimer.mint(defaultMediaData)
          const isValid = await wonzimer.isValidAsk(0, ask)
          expect(isValid).toEqual(false)
        })
      })

      describe('#isVerifiedMedia', () => {
        it('returns true if the media is verified', async () => {
          const wonzimer = new Wonzimer(
            mainWallet,
            50,
            wonzimerConfig.media,
            wonzimerConfig.market
          )
          const mock = new MockAdapter(axios)
          const helloWorldBuf = await fs.readFile('./fixtures/HelloWorld.txt')
          const helloWorldURI =
            'https://ipfs/io/ipfs/Qmf1rtki74jvYmGeqaaV51hzeiaa6DyWc98fzDiuPatzyy'
          const kanyeBuf = await fs.readFile('./fixtures/kanye.jpg')
          const kanyeURI =
            'https://ipfs.io/ipfs/QmRhK7o7gpjkkpubu9EvqDGJEgY1nQxSkP7XsMcaX7pZwV'

          mock.onGet(kanyeURI).reply(200, kanyeBuf)
          mock.onGet(helloWorldURI).reply(200, helloWorldBuf)

          const mediaData = constructMediaData(
            kanyeURI,
            helloWorldURI,
            sha256FromBuffer(kanyeBuf),
            sha256FromBuffer(helloWorldBuf)
          )
          await wonzimer.mint(mediaData)

          const verified = await wonzimer.isVerifiedMedia(0)
          expect(verified).toEqual(true)
        })

        it('returns false if the media is not verified', async () => {
          const wonzimer = new Wonzimer(
            mainWallet,
            50,
            wonzimerConfig.media,
            wonzimerConfig.market
          )
          const mock = new MockAdapter(axios)
          const helloWorldBuf = await fs.readFile('./fixtures/HelloWorld.txt')
          const helloWorldURI =
            'https://ipfs/io/ipfs/Qmf1rtki74jvYmGeqaaV51hzeiaa6DyWc98fzDiuPatzyy'
          const kanyeBuf = await fs.readFile('./fixtures/kanye.jpg')
          const kanyeURI =
            'https://ipfs.io/ipfs/QmRhK7o7gpjkkpubu9EvqDGJEgY1nQxSkP7XsMcaX7pZwV'

          mock.onGet(kanyeURI).reply(200, kanyeBuf)
          mock.onGet(helloWorldURI).reply(200, kanyeBuf) // this will cause verification to fail!

          const mediaData = constructMediaData(
            kanyeURI,
            helloWorldURI,
            sha256FromBuffer(kanyeBuf),
            sha256FromBuffer(helloWorldBuf)
          )
          await wonzimer.mint(mediaData)

          const verified = await wonzimer.isVerifiedMedia(0)
          expect(verified).toEqual(false)
        })

        it('rejects the promise if the media does not exist', async () => {
          const wonzimer = new Wonzimer(
            mainWallet,
            50,
            wonzimerConfig.media,
            wonzimerConfig.market
          )
          await expect(wonzimer.isVerifiedMedia(0)).rejects.toContain(
            'token with that id does not exist'
          )
        })
      })
    })
  })
})
