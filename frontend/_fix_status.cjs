const fs = require('fs');
let c = fs.readFileSync('src/pages/oc/OCTicketDetail.tsx', 'utf8');

// 1. Update statusOrder
c = c.replace(
    /const statusOrder = \['OPEN', 'PENDING_DEP_REP',/g,
    `const statusOrder = ['OPEN', 'HSE_REVIEW', 'PENDING_DEP_REP',`
);

// 2. Update statusSteps to use HSE_REVIEW instead of OPEN (since OPEN is legacy)
c = c.replace(
    /\{ key: 'OPEN', icon:/g,
    `{ key: 'HSE_REVIEW', icon:`
);

// 3. Update canHSEControllerEdit
c = c.replace(
    /ticket\.status === 'OPEN'/g,
    `(ticket.status === 'OPEN' || ticket.status === 'HSE_REVIEW')`
);

// 4. Update the section condition
// It currently checks statusOrder.indexOf('OPEN'). It's fine if OPEN is in statusOrder (index 0).
// But we want it to be > 0 ? No, >= indexOf('OPEN') which is 0. 

// Actually, wait, let's make sure the controller section renders for either OPEN or HSE_REVIEW.
c = c.replace(
    /indexOf\('OPEN'\)/g,
    `indexOf('OPEN')` // This evaluates to 0, which is always true. We want to check if it's rendered for HSE_REVIEW.
);

fs.writeFileSync('src/pages/oc/OCTicketDetail.tsx', c);
console.log('SUCCESS: Fixed status logic');
