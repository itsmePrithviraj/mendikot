export function RulesSheet() {
  return (
    <>
      <p>Four players. Two teams. Your partner sits opposite you.</p>
      <ol className="rules-list">
        <li>
          <strong>Follow the suit.</strong> Play the suit led if you have it. Otherwise play any
          card.
        </li>
        <li>
          <strong>Hukum has the last word.</strong> The highest trump wins. Without a trump, the
          highest card in the led suit wins. A, K, Q, J, 10 … 2.
        </li>
        <li>
          <strong>Collect the tens.</strong> Three tens win. All four make a Mendikot. At two
          each, the team with more tricks wins.
        </li>
      </ol>
      <h3>Two ways to choose hukum</h3>
      <p>
        <strong>Cut hukum:</strong> everyone gets 13 cards. The first legal off-suit card sets
        trump, including for that trick.
      </p>
      <p>
        <strong>Choose hukum:</strong> everyone gets five cards. The player after the dealer
        announces trump, then everyone gets eight more cards.
      </p>
      <p className="small-print">
        Play proceeds anticlockwise. Practice bots use only their own cards and public play. The
        sheep decorates each 10; the number and suit always stay.
      </p>
    </>
  );
}
