use crate::{description, di::Injectable, from_fn_with_description, Handler, HandlerDescription};
use futures::FutureExt;
use std::{ops::ControlFlow, sync::Arc};

/// Constructs a handler that has no further handlers in a chain.
///
/// An endpoint is a handler that _always_ breaks handler execution after its
/// completion. So, you can use it when your chain of responsibility must end
/// up, and handle an incoming event.
#[must_use]
#[track_caller]
pub fn endpoint<'a, F, Input, Output, FnArgs, Descr>(f: F) -> Endpoint<'a, Input, Output, Descr>
where
    F: Injectable<Input, Output, FnArgs> + Send + Sync + 'a,
    Input: Send + 'a,
    Output: 'a,
    Descr: HandlerDescription,
{
    let f = Arc::new(f);

    from_fn_with_description(Descr::endpoint(), move |x, _cont| {
        let f = Arc::clone(&f);
        async move {
            let f = f.inject(&x);
            f().map(ControlFlow::Break).await
        }
    })
}

/// A handler with no further handlers in a chain.
pub type Endpoint<'a, Input, Output, Descr = description::Unspecified> =
    Handler<'a, Input, Output, Descr>;

#[cfg(test)]
mod tests {
    use super::*;
    use crate::{deps, help_inference};

    #[tokio::test]
    async fn test_endpoint() {
        let input = 123;
        let output = 7;

        let result = help_inference(endpoint(move |num: i32| async move {
            assert_eq!(num, input);
            output
        }))
        .dispatch(deps![input])
        .await;

        let result = match result {
            ControlFlow::Break(b) => b,
            _ => panic!("Unexpected: handler return ControlFlow::Break"),
        };
        assert_eq!(result, output);
    }
}
