/*
SPDX-License-Identifier: Apache-2.0
*/

'use strict';

// Fabric smart contract classes
import { Contract, Transaction } from 'fabric-contract-api';

// PaperNet specifc classes
import { CommercialPaper } from '../datamodel/paper';

import CommercialPaperContext from './papercontext';

/**
 * Define commercial paper smart contract by extending Fabric Contract class
 *
 */
export default class CommercialPaperContract extends Contract {

    constructor() {
        // Unique namespace when multiple contracts per chaincode file
        super('org.papernet.commercialpaper');
    }

    /**
     * A custom context provides easy access to list of all commercial papers
     *
     *
     */
    public createContext(): CommercialPaperContext {
        return new CommercialPaperContext();
    }

    /**
     * Instantiate to perform any setup of the ledger that might be required.
     * @param {Context} ctx the transaction context
     */
    @Transaction()
    public async instantiate(ctx: CommercialPaperContext): Promise<Buffer> {
        // no implementation required with this example
        // this could be where datamigration is required
        return Buffer.from('instantiate done');
    }

    /**
     * Issue commercial paper
     *
     * @param {Context} ctx the transaction context
     * @param {String} issuer commercial paper issuer
     * @param {Integer} paperNumber paper number for this issuer
     * @param {String} issueDateTime paper issue date
     * @param {String} maturityDateTime paper maturity date
     * @param {Integer} faceValue face value of paper
     */
    @Transaction()
    public async issue(ctx: CommercialPaperContext,
                       issuer: string,
                       paperNumber: number,
                       issueDateTime: string,
                       maturityDateTime: string,
                       faceValue: number): Promise<Buffer> {

        // create an instance of the paper
        const cp = CommercialPaper.createInstance(issuer, paperNumber, issueDateTime, maturityDateTime, faceValue);

        // Smart contract, rather than paper, moves paper into ISSUED state
        cp.setIssued();

        // set to be owned by the issuer
        cp.setOwner(issuer);

        // Add the paper to the list of all similar commercial papers in the ledger world state
        await ctx.cpList.addPaper(cp);

        // return this - as the function needs to return buffers - serialize it.
        return ctx.returnPaper(cp);
    }

    /**
     * Buy commercial paper
     *
     * @param {TxContext} ctx the transaction context
     * @param {String} issuer commercial paper issuer
     * @param {Integer} paperNumber paper number for this issuer
     * @param {String} currentOwner current owner of paper
     * @param {String} newOwner new owner of paper
     * @param {Integer} price price paid for this paper
     * @param {String} purchaseDateTime time paper was purchased (i.e. traded)
     */
    @Transaction()
    public async buy(ctx, issuer, paperNumber, currentOwner, newOwner, price, purchaseDateTime) {

        // Get a key to be used for the paper, and get this from world state
        const cpKey = CommercialPaper.makeKey([issuer, paperNumber]);
        const cp = await ctx.cpList.getPaper(cpKey);

        // Contract now validates the arguments passed against the current state
        if (cp.getOwner() !== currentOwner) {
            throw new Error('Paper ' + issuer + paperNumber + ' is not owned by ' + currentOwner);
        }
        // First buy moves state from ISSUED to TRADING
        if (cp.isIssued()) {
            cp.setTrading();
        }
        // Check paper is TRADING, not REDEEMED
        if (cp.isTrading()) {
            cp.setOwner(newOwner);
        } else {
            throw new Error('Paper ' + issuer + paperNumber +
                            ' is not trading. Current state = ' + cp.getCurrentState());
        }

        // make sure that the world state has been updated with the new information
        await ctx.cpList.updateState(cp);
        return ctx.returnPaper(cp);
    }

    /**
     * Redeem commercial paper
     * @param {TxContext} ctx the transaction context
     * @param {String} issuer commercial paper issuer
     * @param {Integer} paperNumber paper number for this issuer
     * @param {String} redeemingOwner redeeming owner of paper
     * @param {String} redeemDateTime time paper was redeemed
     */
    @Transaction()
    public async redeem(ctx, issuer, paperNumber, redeemingOwner, redeemDateTime) {

        // Get a key to be used for the paper, and get this from world state
        const cpKey = CommercialPaper.makeKey([issuer, paperNumber]);
        const cp = await ctx.cpList.getPaper(cpKey);

        // Check paper is TRADING, not REDEEMED
        if (cp.isRedeemed()) {
            throw new Error('Paper ' + issuer + paperNumber + ' already redeemed');
        }

        // Verify that the redeemer owns the commercial paper before redeeming it
        if (cp.getOwner() === redeemingOwner) {
            cp.setOwner(cp.getIssuer());
            cp.setRedeemed();
        } else {
            throw new Error('Redeeming owner does not own paper' + issuer + paperNumber);
        }

        await ctx.cpList.updatePaper(cp);
        return ctx.returnPaper(cp);
    }

}
