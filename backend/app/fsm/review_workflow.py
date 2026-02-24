"""Review workflow FSM for contributed products and flagged items."""

from app.fsm.engine import StateMachine, Transition

review_workflow = StateMachine(
    name="review_workflow",
    states=["pending_review", "approved", "rejected", "needs_info"],
    initial_state="pending_review",
    transitions=[
        Transition("pending_review", "approved", "approve",
                   description="Admin approves the contribution"),
        Transition("pending_review", "rejected", "reject",
                   description="Admin rejects the contribution"),
        Transition("pending_review", "needs_info", "request_info",
                   description="Admin requests more information"),
        Transition("needs_info", "pending_review", "resubmit",
                   description="User provides additional info"),
        Transition("rejected", "pending_review", "appeal",
                   description="User appeals the rejection"),
    ],
)
