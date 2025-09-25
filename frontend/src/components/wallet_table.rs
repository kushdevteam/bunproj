use leptos::*;
use crate::api;
use bnb_bundler_shared::*;

#[component]
pub fn WalletTable() -> impl IntoView {
    let (wallets, set_wallets) = create_signal(Vec::<WalletInfo>::new());
    let (is_loading, set_is_loading) = create_signal(false);
    let (selected_wallets, set_selected_wallets) = create_signal(std::collections::HashSet::<String>::new());

    // Mock data for initial display
    create_effect(move |_| {
        let mock_wallets = vec![
            WalletInfo {
                address: "0x1234567890123456789012345678901234567890".to_string(),
                balance_bnb: 0.1,
                balance_tokens: 0.0,
                created_at: chrono::Utc::now(),
            },
            WalletInfo {
                address: "0x2345678901234567890123456789012345678901".to_string(),
                balance_bnb: 0.05,
                balance_tokens: 0.0,
                created_at: chrono::Utc::now(),
            },
            WalletInfo {
                address: "0x3456789012345678901234567890123456789012".to_string(),
                balance_bnb: 0.0,
                balance_tokens: 0.0,
                created_at: chrono::Utc::now(),
            },
        ];
        set_wallets(mock_wallets);
    });

    let refresh_balances = create_action(move |_: &()| {
        async move {
            set_is_loading(true);
            
            let wallet_addresses: Vec<String> = wallets().iter().map(|w| w.address.clone()).collect();
            
            if !wallet_addresses.is_empty() {
                match api::get_balances(wallet_addresses).await {
                    Ok(response) => {
                        if response.success {
                            if let Some(balances) = response.data {
                                // Update wallet balances
                                let updated_wallets: Vec<WalletInfo> = wallets().into_iter().map(|mut wallet| {
                                    if let Some(balance) = balances.iter().find(|b| b.address == wallet.address) {
                                        wallet.balance_bnb = balance.balance_bnb;
                                        wallet.balance_tokens = balance.balance_tokens;
                                    }
                                    wallet
                                }).collect();
                                set_wallets(updated_wallets);
                            }
                        }
                    },
                    Err(e) => {
                        logging::error!("Failed to refresh balances: {}", e);
                    }
                }
            }
            
            set_is_loading(false);
        }
    });

    let toggle_wallet_selection = move |address: String| {
        set_selected_wallets.update(|selected| {
            if selected.contains(&address) {
                selected.remove(&address);
            } else {
                selected.insert(address);
            }
        });
    };

    view! {
        <h3>
            <i class="fas fa-table"></i>
            " Wallet Management"
        </h3>

        <div class="button-group">
            <button
                class="btn-secondary"
                disabled=move || is_loading()
                on:click=move |_| refresh_balances.dispatch(())
            >
                <i class="fas fa-sync-alt"></i>
                {move || if is_loading() { " Refreshing..." } else { " Refresh Balances" }}
            </button>
        </div>

        <div class="wallet-table-container">
            <table class="wallet-table">
                <thead>
                    <tr>
                        <th>
                            <input
                                type="checkbox"
                                on:change=move |_| {
                                    let all_selected = wallets().iter().all(|w| selected_wallets().contains(&w.address));
                                    if all_selected {
                                        set_selected_wallets(std::collections::HashSet::new());
                                    } else {
                                        let all_addresses: std::collections::HashSet<String> = wallets().iter().map(|w| w.address.clone()).collect();
                                        set_selected_wallets(all_addresses);
                                    }
                                }
                            />
                        </th>
                        <th>"Address"</th>
                        <th>"BNB Balance"</th>
                        <th>"Token Balance"</th>
                        <th>"Created"</th>
                        <th>"Actions"</th>
                    </tr>
                </thead>
                <tbody>
                    {move || {
                        wallets().into_iter().map(|wallet| {
                            let address = wallet.address.clone();
                            let address_for_checkbox = address.clone();
                            let address_short = format!("{}...{}", &address[..6], &address[address.len()-4..]);
                            
                            view! {
                                <tr class=move || if selected_wallets().contains(&address) { "selected" } else { "" }>
                                    <td>
                                        <input
                                            type="checkbox"
                                            prop:checked=move || selected_wallets().contains(&address_for_checkbox)
                                            on:change=move |_| toggle_wallet_selection(address_for_checkbox.clone())
                                        />
                                    </td>
                                    <td>
                                        <span class="wallet-address-short" title=&address>
                                            {address_short}
                                        </span>
                                    </td>
                                    <td class="balance-cell">
                                        <span class=move || if wallet.balance_bnb > 0.0 { "balance-positive" } else { "balance-zero" }>
                                            {format!("{:.4}", wallet.balance_bnb)}
                                        </span>
                                        " BNB"
                                    </td>
                                    <td class="balance-cell">
                                        <span class=move || if wallet.balance_tokens > 0.0 { "balance-positive" } else { "balance-zero" }>
                                            {format!("{:.4}", wallet.balance_tokens)}
                                        </span>
                                    </td>
                                    <td class="date-cell">
                                        {wallet.created_at.format("%m/%d %H:%M").to_string()}
                                    </td>
                                    <td>
                                        <button class="btn-small" title="Copy Address">
                                            <i class="fas fa-copy"></i>
                                        </button>
                                        <button class="btn-small" title="View on Explorer">
                                            <i class="fas fa-external-link-alt"></i>
                                        </button>
                                    </td>
                                </tr>
                            }
                        }).collect::<Vec<_>>()
                    }}
                </tbody>
            </table>
        </div>

        {move || {
            let selected_count = selected_wallets().len();
            if selected_count > 0 {
                view! {
                    <div class="selection-actions">
                        <span class="selection-count">{selected_count}" wallets selected"</span>
                        <div class="button-group">
                            <button class="btn-primary">"Fund Selected"</button>
                            <button class="btn-secondary">"Export Keys"</button>
                        </div>
                    </div>
                }.into_view()
            } else {
                view! { <div></div> }.into_view()
            }
        }}
    }
}