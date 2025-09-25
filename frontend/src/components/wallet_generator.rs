use leptos::*;
use crate::api;
use bnb_bundler_shared::*;

#[component]
pub fn WalletGenerator() -> impl IntoView {
    let (wallet_count, set_wallet_count) = create_signal(5u32);
    let (is_generating, set_is_generating) = create_signal(false);
    let (generated_wallets, set_generated_wallets) = create_signal(Vec::<WalletInfo>::new());
    let (error_message, set_error_message) = create_signal(None::<String>);

    let generate_wallets = create_action(move |count: &u32| {
        let count = *count;
        async move {
            set_is_generating(true);
            set_error_message(None);

            let request = GenerateWalletsRequest { count };
            
            match api::generate_wallets(request).await {
                Ok(response) => {
                    if response.success {
                        if let Some(wallets) = response.data {
                            set_generated_wallets(wallets);
                        }
                    } else {
                        set_error_message(response.error);
                    }
                },
                Err(e) => {
                    set_error_message(Some(format!("Failed to generate wallets: {}", e)));
                }
            }

            set_is_generating(false);
        }
    });

    view! {
        <h3>
            <i class="fas fa-plus-circle"></i>
            " Wallet Generator"
        </h3>
        
        <div class="form-group">
            <label>"Number of wallets:"</label>
            <input
                type="number"
                min="1"
                max="100"
                prop:value=move || wallet_count().to_string()
                on:input=move |ev| {
                    if let Ok(value) = event_target_value(&ev).parse::<u32>() {
                        set_wallet_count(value);
                    }
                }
            />
        </div>

        <div class="button-group">
            <button
                class="btn-primary"
                disabled=move || is_generating()
                on:click=move |_| {
                    generate_wallets.dispatch(wallet_count());
                }
            >
                {move || if is_generating() { "Generating..." } else { "Generate Wallets" }}
            </button>
        </div>

        {move || error_message().map(|error| view! {
            <div class="alert alert-error">
                <i class="fas fa-exclamation-triangle"></i>
                {error}
            </div>
        })}

        {move || {
            let wallets = generated_wallets();
            if !wallets.is_empty() {
                view! {
                    <div class="generated-wallets">
                        <h4>"Generated Wallets"</h4>
                        <div class="wallets-grid">
                            {wallets.into_iter().map(|wallet| view! {
                                <div class="wallet-item">
                                    <div class="wallet-address">{wallet.address}</div>
                                    <div class="wallet-balance">{format!("{:.4} BNB", wallet.balance_bnb)}</div>
                                </div>
                            }).collect::<Vec<_>>()}
                        </div>
                    </div>
                }.into_view()
            } else {
                view! { <div></div> }.into_view()
            }
        }}
    }
}