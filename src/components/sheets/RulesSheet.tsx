export function RulesSheet() {
  return (
    <>
      <p>
        Four players in two teams; partners sit opposite. Play passes
        anticlockwise.
      </p>
      <ul className="rules-list">
        <li>
          <strong>Follow suit</strong> if you can. Otherwise play any card.
        </li>
        <li>
          <strong>Hukum beats every suit.</strong> Without hukum, the highest
          card of the suit led wins. A K Q J 10 … 2.
        </li>
        <li>
          <strong>Win the tens.</strong> Three tens win the deal; all four is a
          Mendikot. At two each, more tricks wins.
        </li>
        <li>
          <strong>Cut hukum:</strong> 13 cards each. The first off-suit card
          played becomes hukum.
        </li>
        <li>
          <strong>Choose hukum:</strong> five cards each. The player after the
          dealer names hukum, then eight more cards are dealt.
        </li>
      </ul>
      <p className="small-print">Bots see only their own cards.</p>
    </>
  );
}
